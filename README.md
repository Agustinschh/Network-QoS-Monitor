# 01 Network QoS Monitor (Quality of Service)
> **Licenciatura en Sistemas de Información — Desarrollo de Aplicaciones Móviles 2026**  
> Aplicación móvil nativa en **React Native CLI (Bare)** y **Backend de Referencia Fastify** para auditoría, diagnóstico y monitoreo de Calidad de Servicio en redes móviles (5G/4G/3G) y Wi-Fi.

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Matriz de Trazabilidad de Requisitos (RF-01 a RF-09)](#-matriz-de-trazabilidad-de-requisitos)
3. [Arquitectura del Sistema](#-arquitectura-del-sistema)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Instrucciones de Instalación y Ejecución](#-instrucciones-de-instalación-y-ejecución)
6. [Módulos Nativos y Algoritmos Implementados](#-módulos-nativos-y-algoritmos-implementados)
7. [Capturas de Pantalla y Evidencias](#-capturas-de-pantalla-y-evidencias)
8. [Video Demostrativo](#-video-demostrativo)

---

## 📱 Descripción General
**01 Network QoS Monitor** es una herramienta integral de telecomunicaciones móviles diseñada para evaluar con precisión científica el desempeño de la conectividad celular y Wi-Fi en dispositivos Android. La solución combina módulos nativos en Kotlin (`TelephonyManager`, `MediaStore`), sockets TCP de bajo nivel (`react-native-tcp-socket`), almacenamiento embebido SQLite de alto rendimiento (`@op-engineering/op-sqlite`), visualización geoespacial con mapas de calor (`react-native-maps`), monitoreo en segundo plano con alertas Notifee (`@notifee/react-native`) y un backend de referencia en Fastify optimizado para benchmarking de throughput y latencia.

---

## 🎯 Matriz de Trazabilidad de Requisitos

| Requisito | Descripción | Implementación Técnica | Estado |
| :--- | :--- | :--- | :---: |
| **RF-01** | **Módulo de Telefonía Nativo**<br>Extracción de operador, tecnología (5G NR, LTE, 3G, 2G) y potencia de señal en dBm. | • `TelephonyModule.kt` (Bridge Kotlin con `TelephonyManager`, `CellInfoLte`, `CellInfoNr`, `CellSignalStrength`).<br>• Detección en tiempo real de operador y dBm en UI. | ✅ **Completado** |
| **RF-02** | **Sonda de Latencia RTT vía Sockets TCP**<br>Medición RTT sobre 3 hosts configurables, cálculo de jitter (RFC 3550) y % de pérdida. | • `PingEngine.ts` utilizando `react-native-tcp-socket`.<br>• Hosts: Google DNS (8.8.8.8:53), Cloudflare (1.1.1.1:53) y Servidor QoS (10.0.2.2:3000).<br>• Algoritmo de Jitter RFC 3550: $J_i = J_{i-1} + \frac{(\|D_{i-1,i}\| - J_{i-1})}{16}$. | ✅ **Completado** |
| **RF-03** | **Throughput de Descarga y Subida**<br>Benchmarking en Mbps contra backend de referencia dedicado con streams de datos. | • `ThroughputEngine.ts` interactuando con Fastify `/api/download` y `/api/upload`.<br>• Transferencia en chunks con control de ventanas de tiempo y cálculo en Mbps. | ✅ **Completado** |
| **RF-04** | **Persistencia Local y Geolocalización**<br>Almacenamiento en SQLite de cada sesión con coordenadas GPS y timestamp. | • `@op-engineering/op-sqlite` con base de datos `qos_monitor.db`.<br>• Índices B-Tree en timestamp, coordenadas y tipo de red.<br>• `LocationService.ts` con `react-native-geolocation-service` (Google Fused Location Provider). | ✅ **Completado** |
| **RF-05** | **Visualización Geoespacial (Mapa y Heatmap)**<br>Representación geográfica de mediciones, mapa de calor y marcadores interactivos. | • `MapCoverageScreen.tsx` con `react-native-maps`.<br>• Capa Heatmap con gradiente de color ponderado por Throughput/Señal.<br>• Pines de colores según generación de red (5G verde esmeralda, 4G azul, Wi-Fi índigo).<br>• Carrusel deslizable inferior sincronizado con la cámara del mapa. | ✅ **Completado** |
| **RF-06** | **Gráficos Temporales por Sesión**<br>Visualización cronológica de throughput y latencia/jitter entre sesiones. | • `QoSBarChart.tsx` integrado en `HistoryScreen.tsx`.<br>• Gráfico 1: Throughput de Descarga vs Subida en Mbps.<br>• Gráfico 2: Latencia RTT promedio vs Jitter estadístico RFC 3550 en ms. | ✅ **Completado** |
| **RF-07** | **Muestreo en Background y Alertas**<br>Sondeo periódico configurable en segundo plano y notificaciones ante degradación severa. | • `BackgroundMonitorService.ts` + `@notifee/react-native`.<br>• Canal Android con importancia alta, sonido, vibración y LED rojo.<br>• Umbrales de degradación: RTT > 250 ms, Señal < -115 dBm, Pérdida > 50%.<br>• Botón de simulación y persistencia de eventos con tag `[BACKGROUND_ALERT]`. | ✅ **Completado** |
| **RF-08** | **Exportación de Datos (CSV / JSON)**<br>Generación de reportes completos exportables y transferibles fuera del dispositivo. | • `ExportService.ts` con soporte RFC 4180 para CSV y JSON estructurado.<br>• `FileExportModule.kt` nativo guardando en `/sdcard/Download/` vía `MediaStore.Downloads`.<br>• Integración con menú de compartición nativo de Android (`ShareSheet`). | ✅ **Completado** |
| **RF-09** | **Filtrado Avanzado del Historial**<br>Filtro por tipo de red (Móvil vs Wi-Fi), fecha y delimitación geográfica. | • Consultas parametrizadas en SQLite (`QueryFilters` en `db.ts`).<br>• Chips interactivos de filtrado rápido en tiempo real en `HistoryScreen.tsx`. | ✅ **Completado** |

---

## 🏗️ Arquitectura del Sistema

```
                  ┌────────────────────────────────────────┐
                  │          Android Mobile App            │
                  │        (React Native CLI Bare)         │
                  └───────────────────┬────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐             ┌───────────────┐             ┌───────────────┐
│ Módulos       │             │   Core QoS    │             │ Persistencia  │
│ Nativos       │             │    Engines    │             │   y Alertas   │
├───────────────┤             ├───────────────┤             ├───────────────┤
│• Telephony-   │             │• PingEngine   │             │• op-sqlite    │
│  Manager (dBm)│             │  (TCP Socket) │             │  (SQLite DB)  │
│• MediaStore   │             │• Throughput-  │             │• Geolocation  │
│  (Downloads)  │             │  Engine (HTTP)│             │• Notifee      │
└───────┬───────┘             └───────┬───────┘             └───────┬───────┘
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       Backend de Referencia QoS        │
                  │            (Node.js Fastify)           │
                  │   • /api/ping      • /api/download     │
                  │   • /api/upload    • Port: 3000        │
                  └────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
trabajo 5/
├── backend/                             # Servidor Fastify de Referencia QoS
│   ├── src/
│   │   └── server.ts                    # Endpoints /api/ping, /api/download, /api/upload
│   ├── package.json
│   └── tsconfig.json
│
└── mobile/                              # Aplicación React Native CLI (Bare)
    ├── android/                         # Proyecto Nativo Android
    │   ├── app/src/main/java/com/com.qosmonitor/
    │   │   ├── MainActivity.kt
    │   │   ├── MainApplication.kt
    │   │   ├── TelephonyModule.kt       # RF-01: Extracción nativa de dBm y 5G/4G
    │   │   ├── FileExportModule.kt      # RF-08: Guardado en Downloads con MediaStore
    │   │   └── TelephonyPackage.kt      # Registro de paquetes nativos
    │   └── build.gradle                 # Configuración de dependencias (Play Services 21.3.0)
    │
    ├── src/
    │   ├── components/
    │   │   └── charts/
    │   │       └── QoSBarChart.tsx      # RF-06: Gráficos de barras temporales
    │   ├── core/
    │   │   ├── ping/
    │   │   │   └── PingEngine.ts        # RF-02: Socket TCP y Jitter RFC 3550
    │   │   ├── throughput/
    │   │   │   └── ThroughputEngine.ts  # RF-03: Pruebas de velocidad de bajada/subida
    │   │   ├── telephony/
    │   │   │   └── TelephonyService.ts  # RF-01: Wrapper TypeScript del módulo nativo
    │   │   ├── location/
    │   │   │   └── LocationService.ts   # RF-04: Geolocalización GPS precisa
    │   │   ├── notifications/
    │   │   │   └── NotificationService.ts # RF-07: Notifee canales y alertas
    │   │   ├── monitoring/
    │   │   │   └── BackgroundMonitorService.ts # RF-07: Sondeo periódico en background
    │   │   └── export/
    │   │       └── ExportService.ts     # RF-08: Exportador CSV (RFC 4180) y JSON
    │   ├── database/
    │   │   ├── schema.ts                # Esquema e interfaces de SQLite
    │   │   └── db.ts                    # Métodos CRUD e índices para RF-04 y RF-09
    │   ├── screens/
    │   │   ├── DashboardScreen/         # Pantalla principal con velocímetros y diagnóstico
    │   │   ├── MapCoverageScreen/       # RF-05: Mapa, Heatmap y carrusel de puntos
    │   │   ├── HistoryScreen/           # RF-06, RF-08, RF-09: Historial, gráficos y export
    │   │   └── SettingsScreen/          # RF-07: Configuración de umbrales y monitoreo
    │   ├── store/
    │   │   ├── qosStore.ts              # Zustand store para estado global de mediciones
    │   │   └── monitoringStore.ts       # Zustand store para estado de muestreo
    │   └── theme/
    │       └── index.ts                 # Sistema de diseño dark mode con tokens
    └── package.json
```

---

## 🚀 Instrucciones de Instalación y Ejecución

### 1. Prerrequisitos
- **Node.js**: v20.x o superior.
- **Java Development Kit**: JDK 17 (Azul Zulu o Eclipse Temurin).
- **Android Studio**: Android SDK Platform 34 y Android SDK Build-Tools 34.0.0.
- **Emulador o Dispositivo Físico**: Android 10+ (API 29 a 34 recomendada).

---

### 2. Poner en Marcha el Backend de Referencia
En una terminal:
```bash
cd backend
npm install
npm run dev
```
El servidor escuchará en `http://localhost:3000`.

---

### 3. Configurar ADB Reverse (Para comunicación con el emulador)
```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

---

### 4. Compilar y Ejecutar la Aplicación Móvil
En una segunda terminal:
```bash
cd mobile
npm install
npm start
```

En una tercera terminal (para instalar la app en el emulador):
```bash
cd mobile
npm run android
```
*(O alternativamente desde la carpeta `mobile/android`: `./gradlew installDebug`)*.

---

## 🔬 Módulos Nativos y Algoritmos Implementados

### 1. Cálculo de Jitter Estadístico (RFC 3550)
Para garantizar precisión matemática en la evaluación de la calidad de voz y streaming en tiempo real, el cálculo de jitter no utiliza una simple desviación estándar sino la fórmula de diferencias en tiempo de tránsito definida por el **IETF en RFC 3550 (Sección 6.4.1)**:
$$D(i-1, i) = RTT_i - RTT_{i-1}$$
$$J_i = J_{i-1} + \frac{|D(i-1, i)| - J_{i-1}}{16}$$

### 2. Extracción de Señal Celular en Android (`TelephonyModule.kt`)
Utiliza la API `TelephonyManager.getAllCellInfo()` con reflexión y tipado seguro para extraer:
- En redes **5G NR**: `CellInfoNr` $\rightarrow$ `CellSignalStrengthNr.dbm` y `ssRsrp`.
- En redes **4G LTE**: `CellInfoLte` $\rightarrow$ `CellSignalStrengthLte.dbm` y `rsrp`.
- En redes heredadas **3G/2G**: `CellInfoWcdma` / `CellInfoGsm`.
- Nivel normalizado de calidad (0 a 4 barras).

### 3. Exportación de Archivos a Storage Público (`FileExportModule.kt`)
Compatible con las políticas de Scoped Storage de Android 10, 11, 12, 13 y 14:
- Inserta los metadatos en `MediaStore.Downloads.EXTERNAL_CONTENT_URI`.
- Abre un stream directo `resolver.openOutputStream(uri)` con codificación UTF-8.
- Los archivos generados quedan inmediatamente disponibles en `/sdcard/Download/` y en la aplicación "Archivos" de Android.

---

## 📊 Formatos de Exportación (RF-08)

### Formato CSV (RFC 4180)
Encabezado estándar:
```csv
id,session_id,timestamp,iso_date,network_type,cellular_generation,operator,signal_dbm,signal_level,ping_min_ms,ping_avg_ms,ping_max_ms,jitter_ms,packet_loss_pct,download_mbps,upload_mbps,latitude,longitude,altitude,accuracy,notes
```

### Formato JSON
Estructura del payload exportado:
```json
{
  "exportMetadata": {
    "appName": "01 Network QoS Monitor",
    "version": "1.0.0",
    "exportedAt": "2026-10-27T22:28:29.518Z",
    "totalRecords": 4
  },
  "measurements": [
    {
      "id": 4,
      "sessionId": "sim_alert_1793139361504",
      "timestamp": 1793139361504,
      "isoDate": "2026-10-27T22:16:01.504Z",
      "networkType": "wifi",
      "cellularGeneration": "5g",
      "operator": "T-Mobile",
      "signalDbm": -118,
      "signalLevel": 1,
      "pingAvgMs": 340,
      "jitterMs": 45.2,
      "packetLossPct": 20,
      "downloadMbps": 4.2,
      "uploadMbps": 0.8,
      "latitude": 37.4219983,
      "longitude": -122.084,
      "notes": "[SIMULATED_DEGRADATION_ALERT]"
    }
  ]
}
```

---

## 🎥 Video Demostrativo
El video demostrativo de la aplicación en funcionamiento se puede encontrar en:  
🔗 [Ver Video Demostrativo en Google Drive](https://drive.google.com/file/d/1GD6HSTFa-68mPsqJEjQdiD24_jZCfUFt/view?usp=sharing)

---
*Desarrollado para la cátedra de Desarrollo de Aplicaciones Móviles 2026.*
