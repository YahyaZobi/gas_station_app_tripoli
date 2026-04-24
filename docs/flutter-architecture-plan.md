# Flutter Architecture Plan

## Recommended Stack

- Flutter
- Riverpod
- Feature-first folder structure
- Clean domain layer for station logic
- Mapbox for maps

## Folder Structure

```text
lib/
  app/
    app.dart
    router.dart
    theme.dart
    localization/
      ar.dart

  core/
    constants/
      app_constants.dart
    utils/
      date_time_utils.dart
      distance_utils.dart
    errors/
      app_exception.dart

  features/
    stations/
      domain/
        entities/
          station.dart
          station_report.dart
          station_status_summary.dart
        services/
          station_aggregator.dart
        repositories/
          station_repository.dart

      data/
        models/
          station_model.dart
          station_report_model.dart
        datasources/
          station_local_datasource.dart
          station_remote_datasource.dart
        repositories/
          station_repository_impl.dart

      presentation/
        providers/
          station_list_provider.dart
          selected_station_provider.dart
          report_modal_provider.dart
        screens/
          home_screen.dart
        widgets/
          station_map.dart
          station_list.dart
          station_card.dart
          station_details_sheet.dart
          report_modal.dart

  main.dart
```

## State Management

Use Riverpod.

- `stationListProvider`: stations plus computed summaries
- `selectedStationProvider`: selected station
- `reportModalProvider`: modal open and close state
- `reportActionProvider`: report submission state
- `demoUpdatesProvider`: temporary MVP timer updates

## Reusing Current Logic

Port the current pure logic from `logic.mjs` into Dart services and utilities.

- `createReportRecord`
- `minutesSince`
- `isReportRecent`
- `getReportWeight`
- `aggregateStation`
- `projectStations`
- `formatRelativeTime`

Keep internal status keys stable and localize labels only in the presentation layer.

## Backend Later

Hide backend details behind `StationRepository`.

Repository responsibilities later:

- get stations
- get recent reports
- submit report
- watch realtime station updates

Suggested evolution:

1. In-memory only
2. Local cache
3. Remote API
4. Realtime subscriptions

Good backend options later:

- Supabase
- Firebase
- Custom REST/WebSocket backend
