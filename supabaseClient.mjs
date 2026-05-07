export function getSupabaseConfig(runtimeEnv = import.meta.env ?? {}, browserWindow = globalThis) {
  const browserConfig = browserWindow?.BENZINA_CONFIG ?? {};
  const url =
    browserConfig.SUPABASE_URL ??
    runtimeEnv.SUPABASE_URL ??
    runtimeEnv.VITE_SUPABASE_URL ??
    browserWindow.SUPABASE_URL ??
    "";
  const anonKey =
    browserConfig.SUPABASE_ANON_KEY ??
    runtimeEnv.SUPABASE_ANON_KEY ??
    runtimeEnv.VITE_SUPABASE_ANON_KEY ??
    browserWindow.SUPABASE_ANON_KEY ??
    "";

  return {
    url: String(url).trim(),
    anonKey: String(anonKey).trim(),
  };
}

function normalizeLogger(logger = console) {
  return {
    info: typeof logger?.info === "function" ? logger.info.bind(logger) : () => {},
    warn: typeof logger?.warn === "function" ? logger.warn.bind(logger) : () => {},
  };
}

function getRealtimeWebSocketUrl(url, anonKey) {
  const parsedUrl = new URL(url);
  const protocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsedUrl.host}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;
}

function getRealtimeInsertRecord(payload) {
  const data = payload?.data ?? payload ?? {};
  if (data.eventType && data.eventType !== "INSERT") {
    return null;
  }

  return data.record ?? data.new ?? payload?.record ?? payload?.new ?? null;
}

export function createSupabaseClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  config = getSupabaseConfig(),
  logger = console,
  websocketFactory = (url) => new globalThis.WebSocket(url),
} = {}) {
  const log = normalizeLogger(logger);
  const isConfigured = Boolean(config.url && config.anonKey && fetchImpl);

  if (isConfigured) {
    log.info("[Supabase] Config detected: yes.");
  } else {
    log.warn("[Supabase] Config detected: no. Falling back to local storage data source.");
  }

  return {
    isConfigured,
    config,
    async select(path, query = "") {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const separator = query ? `?${query}` : "";
      const response = await fetchImpl(`${config.url}/rest/v1/${path}${separator}`, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase select failed: ${response.status}`);
      }

      return response.json();
    },
    async insert(path, payload) {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Supabase insert failed: ${response.status}`);
      }

      return response.json();
    },
    async upsert(path, payload, onConflictColumns = []) {
      if (!isConfigured) {
        throw new Error("Supabase is not configured.");
      }

      const query = onConflictColumns.length
        ? `?on_conflict=${encodeURIComponent(onConflictColumns.join(","))}`
        : "";
      const response = await fetchImpl(`${config.url}/rest/v1/${path}${query}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=merge-duplicates",
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Supabase upsert failed: ${response.status}${errorBody ? ` ${errorBody}` : ""}`,
        );
      }

      return response.json();
    },
    subscribeToReportInserts(onInsert) {
      if (!isConfigured) {
        log.warn("[Supabase] Realtime disabled. Reason: config missing.");
        return () => {};
      }

      if (typeof websocketFactory !== "function") {
        log.warn("[Supabase] Realtime disabled. Reason: WebSocket is not available.");
        return () => {};
      }

      if (typeof onInsert !== "function") {
        log.warn("[Supabase] Realtime disabled. Reason: missing insert callback.");
        return () => {};
      }

      const topic = "realtime:public:reports";
      const socketUrl = getRealtimeWebSocketUrl(config.url, config.anonKey);
      let heartbeatTimerId = null;
      let refCounter = 0;
      let socket = null;
      let isClosedManually = false;

      const nextRef = () => {
        refCounter += 1;
        return String(refCounter);
      };

      const sendMessage = (event, payload = {}, customTopic = topic) => {
        if (!socket || socket.readyState !== 1) {
          return;
        }

        socket.send(JSON.stringify({
          topic: customTopic,
          event,
          payload,
          ref: nextRef(),
        }));
      };

      try {
        socket = websocketFactory(socketUrl);
      } catch {
        log.warn("[Supabase] Realtime disabled. Reason: failed to open WebSocket.");
        return () => {};
      }

      socket.addEventListener("open", () => {
        sendMessage("phx_join", {
          config: {
            broadcast: {
              ack: false,
              self: false,
            },
            postgres_changes: [
              {
                event: "INSERT",
                schema: "public",
                table: "reports",
              },
            ],
            private: false,
          },
        });

        heartbeatTimerId = globalThis.setInterval(() => {
          sendMessage("heartbeat", {}, "phoenix");
        }, 30000);

        log.info("[Supabase] Realtime connected for reports inserts.");
      });

      socket.addEventListener("message", (messageEvent) => {
        try {
          const message = JSON.parse(messageEvent.data);
          const insertRecord =
            message?.event === "postgres_changes" || message?.event === "INSERT"
              ? getRealtimeInsertRecord(message.payload)
              : null;

          if (!insertRecord) {
            return;
          }

          onInsert(insertRecord);
        } catch {
          log.warn("[Supabase] Realtime message ignored. Reason: invalid payload.");
        }
      });

      socket.addEventListener("error", () => {
        log.warn("[Supabase] Realtime error. App will continue without live updates.");
      });

      socket.addEventListener("close", () => {
        if (heartbeatTimerId) {
          globalThis.clearInterval(heartbeatTimerId);
          heartbeatTimerId = null;
        }

        if (!isClosedManually) {
          log.warn("[Supabase] Realtime disconnected. App will continue without live updates.");
        }
      });

      return () => {
        isClosedManually = true;
        if (heartbeatTimerId) {
          globalThis.clearInterval(heartbeatTimerId);
          heartbeatTimerId = null;
        }

        socket?.close();
      };
    },
  };
}
