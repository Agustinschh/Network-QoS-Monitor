import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

export class NotificationService {
  private static isInitialized = false;

  /**
   * Inicializa los canales de notificación en Android.
   */
  public static async init(): Promise<void> {
    if (this.isInitialized || Platform.OS !== 'android') return;

    try {
      // Canal prioritario para alertas de degradación severa (RF-07)
      await notifee.createChannel({
        id: 'qos-alerts',
        name: 'Alertas de Calidad QoS',
        description: 'Notificaciones críticas cuando se detecta degradación severa de red (RTT alto o pérdida de señal)',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        lights: true,
        lightColor: '#FF5C7A',
      });

      // Canal para estado del servicio en background
      await notifee.createChannel({
        id: 'qos-monitoring',
        name: 'Monitoreo de Red en Segundo Plano',
        description: 'Canal de servicio periódico para muestreo de QoS',
        importance: AndroidImportance.LOW,
      });

      this.isInitialized = true;
      console.log('[NotificationService] Canales Notifee inicializados exitosamente.');
    } catch (e) {
      console.warn('[NotificationService] Error inicializando canales:', e);
    }
  }

  /**
   * Solicita permisos de notificación (Android 13+).
   */
  public static async requestPermission(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      return (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch (e) {
      console.warn('[NotificationService] Error solicitando permisos de notificación:', e);
      return false;
    }
  }

  /**
   * Dispara una alerta de degradación de red (RF-07).
   */
  public static async sendDegradationAlert(params: {
    title: string;
    body: string;
    metricType: 'rtt' | 'signal' | 'loss';
    metricValue: number;
    threshold: number;
  }): Promise<string> {
    await this.init();
    await this.requestPermission();

    const notificationId = `alert_${Date.now()}`;

    await notifee.displayNotification({
      id: notificationId,
      title: params.title,
      body: params.body,
      android: {
        channelId: 'qos-alerts',
        importance: AndroidImportance.HIGH,
        color: '#FF5C7A',
        pressAction: {
          id: 'default',
        },
        style: {
          type: 1, // BigTextStyle
          text: `${params.body}\n\n• Métrica: ${params.metricValue} (Umbral: ${params.threshold})\n• Monitoreo Periódico Activo (RF-07)`,
        },
      },
    });

    console.log('[NotificationService] Alerta de degradación enviada:', params.title);
    return notificationId;
  }

  /**
   * Envía una notificación de prueba para verificar el canal Notifee.
   */
  public static async sendTestNotification(): Promise<void> {
    await this.init();
    await this.requestPermission();

    await notifee.displayNotification({
      title: '🟢 Canal QoS Verificado',
      body: 'El sistema de notificaciones de degradación de red (RF-07) está operativo.',
      android: {
        channelId: 'qos-alerts',
        importance: AndroidImportance.HIGH,
        color: '#2ED6A3',
        pressAction: {
          id: 'default',
        },
      },
    });
  }
}
