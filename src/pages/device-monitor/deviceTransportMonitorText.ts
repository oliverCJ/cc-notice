import {
  DeviceTransportMonitorCategory,
  DeviceTransportMonitorDirection,
  DeviceTransportMonitorStatus
} from '@/api/tauriApi';

export function monitorDirectionLabelKey(direction: DeviceTransportMonitorDirection) {
  return `devices.transportMonitor.direction.${direction}`;
}

export function monitorCategoryLabelKey(category: DeviceTransportMonitorCategory) {
  return `devices.transportMonitor.category.${category}`;
}

export function monitorStatusLabelKey(status: DeviceTransportMonitorStatus) {
  return `devices.transportMonitor.status.${status}`;
}

