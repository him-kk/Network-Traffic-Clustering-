# Network Traffic Clustering Platform Documentation

## Overview
This platform provides real-time network traffic clustering, anomaly detection, visualization, and reporting. It supports live data capture, import/export, ML model training, and API integration.

## Features
- Core clustering algorithms: K-Means, DBSCAN, Hierarchical, Mean Shift, GMM, SOM
- Advanced anomaly detection: Isolation Forest, Autoencoder
- Real-time dashboard with protocol/time series charts
- 3D and canvas-based cluster visualization
- Data import/export (PCAP, CSV, JSON)
- WebSocket live capture & alerting
- ML pipeline & model training
- Reporting & API integration

## Usage
1. **Monitoring**: Start/stop real-time traffic monitoring from the dashboard.
2. **Clustering**: Select an algorithm and run clustering on captured/imported flows.
3. **Anomaly Detection**: View detected anomalies and alerts in the dashboard.
4. **Visualization**: Explore clusters and network topology in 2D/3D views.
5. **Import/Export**: Import/export flows in CSV, JSON, or PCAP formats.
6. **ML Pipeline**: Train and manage clustering/anomaly models from the dashboard.
7. **Reporting**: Generate and send reports via the dashboard UI.

## Developer Guide
- **Clustering Algorithms**: See `src/algorithms/` for implementations.
- **Anomaly Detection**: See `src/anomaly/detector.ts`.
- **Data Layer**: See `src/data/` for traffic generation, import/export, ML pipeline, and reporting utilities.
- **Dashboard UI**: Main logic in `src/dashboard/Dashboard.tsx`.
- **Types**: All shared types in `src/types/index.ts`.

## Extending
- Add new clustering/anomaly algorithms in `src/algorithms/` or `src/anomaly/`.
- Extend import/export formats in `src/data/importExport.ts`.
- Add new report sections in `src/data/reporting.ts`.
- Integrate new APIs in `src/data/reporting.ts` or via WebSocket in the dashboard.

## API Example
To send a report:
```js
await sendReportToAPI(report, 'https://your-api-endpoint');
```

## WebSocket Example
The dashboard connects to `ws://localhost:8080/live` for live flow and alert data.

## License
MIT

## Design

- **Color Theme**: Deep forest charcoal (#0d1310) with off-white (#f4f4f4) alternating sections
- **Typography**: Manrope (headings), Playfair Display (italic accents), DM Sans (body)
- **Animations**: GSAP ScrollTrigger with clip-path reveals, parallax, scale effects, and staggered entrances
- **Layout**: Alternating dark/light sections, max-width 7xl container

## Notes

- All animations use GSAP with ScrollTrigger for scroll-driven effects
- Lenis provides smooth scroll behavior connected to GSAP ticker
- The Swiper carousel auto-plays with configurable breakpoints
- Service and footer icons use a string-to-component map (iconName field maps to Lucide icon components: Camera, Diamond, Users, Sparkles, Instagram, Twitter, Linkedin, Mail)
