export function getProtocolWarning(protocol) {
  if (protocol === "file:") {
    return "شغّل التطبيق من localhost بدل فتحه مباشرة عبر file:// حتى تعمل الخريطة والموقع بشكل صحيح.";
  }

  return "";
}
