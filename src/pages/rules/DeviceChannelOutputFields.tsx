import { HardwareOutput } from '../../api/tauriApi';
import { ChannelSelectOption, DeviceSelectOption, defaultChannelOptions } from './deviceChannelOptions';
import { DeviceChannelActionGroupFields } from './DeviceChannelActionGroupFields';
import { CustomFaceLibraryEntries } from '@/domain/customFaces/library';

type DeviceChannelOutputFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  deviceOptions?: DeviceSelectOption[];
  channelOptions?: ChannelSelectOption[];
  lockIdentityFields?: boolean;
  customFaceLibrary?: CustomFaceLibraryEntries | null;
  customFaceLibraryLoading?: boolean;
  onReloadCustomFaceLibrary?: () => void;
  onChange: (output: HardwareOutput) => void;
};

export function DeviceChannelOutputFields({
  internalEvent,
  output,
  deviceOptions,
  channelOptions = defaultChannelOptions,
  lockIdentityFields = false,
  customFaceLibrary,
  customFaceLibraryLoading = false,
  onReloadCustomFaceLibrary,
  onChange
}: DeviceChannelOutputFieldsProps) {
  return (
    <DeviceChannelActionGroupFields
      internalEvent={internalEvent}
      output={output}
      deviceOptions={deviceOptions}
      channelOptions={channelOptions}
      lockIdentityFields={lockIdentityFields}
      customFaceLibrary={customFaceLibrary}
      customFaceLibraryLoading={customFaceLibraryLoading}
      onReloadCustomFaceLibrary={onReloadCustomFaceLibrary}
      onChange={onChange}
    />
  );
}
