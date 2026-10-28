# 01 Network QoS Monitor — Aplicación Móvil React Native CLI

Módulo cliente móvil desarrollado en **React Native CLI (Bare)** para la cátedra de Desarrollo de Aplicaciones Móviles 2026.

Consulta el documento principal del proyecto en [`../README.md`](../README.md) para la matriz completa de trazabilidad de requisitos (RF-01 a RF-09), algoritmos matemáticos (RFC 3550) y detalles de arquitectura.

---

## 🛠️ Comandos de Desarrollo Móvil

### Iniciar Metro Bundler
```bash
npm start
```

### Ejecutar en Dispositivo o Emulador Android
```bash
npm run android
```

### Compilar APK directamente vía Gradle
```bash
cd android
./gradlew installDebug
```

### Verificar Tipado TypeScript
```bash
npx tsc --noEmit
```

### Configuración de Red con Emulador Android
Para que el emulador se comunique con el backend Fastify y Metro en la máquina host:
```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

---

## 📦 Dependencias Nativas Principales
- **`@notifee/react-native`**: Gestión de notificaciones locales de alta prioridad, canales de sonido/vibración y alertas en segundo plano (RF-07).
- **`@op-engineering/op-sqlite`**: Motor SQLite embebido de máxima velocidad para persistencia local de métricas georreferenciadas (RF-04).
- **`react-native-maps`**: Renderizado de mapa de calor geoespacial y pines interactivos sincronizados (RF-05).
- **`react-native-tcp-socket`**: Sockets TCP a bajo nivel para pruebas de latencia RTT y cálculo de Jitter RFC 3550 (RF-02).
- **`react-native-geolocation-service`**: Proveedor de ubicación de alta precisión (Google Fused Location) para etiquetado GPS (RF-04).
- **`FileExportModule.kt`**: Módulo nativo en Kotlin para guardado directo en la carpeta pública de Descargas de Android utilizando `MediaStore.Downloads` (RF-08).
- **`TelephonyModule.kt`**: Módulo nativo en Kotlin que interactúa con `TelephonyManager` para capturar dBm y tecnología 5G NR/4G (RF-01).
