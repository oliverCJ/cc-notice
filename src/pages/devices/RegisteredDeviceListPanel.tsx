import { DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { DeviceListPanel } from './DeviceListPanel';

type RegisteredDeviceListPanelProps = {
  states: DeviceRuntimeState[];
  loading: boolean;
  selectedDeviceId: string | null;
  error: DeviceRuntimeError | null;
  onSelectDevice: (deviceId: string) => void;
  onRemoveDevice: (deviceId: string) => void;
  onOpenRulesPage?: () => void;
};

export function RegisteredDeviceListPanel(props: RegisteredDeviceListPanelProps) {
  return <DeviceListPanel {...props} />;
}
