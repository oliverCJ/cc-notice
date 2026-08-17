import { HardwareOutput } from '../../api/tauriApi';
import { ChannelSelectOption, DeviceSelectOption, defaultChannelOptions } from './deviceChannelOptions';
import { DeviceChannelActionGroupFields } from './DeviceChannelActionGroupFields';

type DeviceChannelOutputFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  deviceOptions?: DeviceSelectOption[];
  channelOptions?: ChannelSelectOption[];
  lockIdentityFields?: boolean;
  onChange: (output: HardwareOutput) => void;
};

export function DeviceChannelOutputFields({
  internalEvent,
  output,
  deviceOptions,
  channelOptions = defaultChannelOptions,
  lockIdentityFields = false,
  onChange
}: DeviceChannelOutputFieldsProps) {
  return (
    <DeviceChannelActionGroupFields
      internalEvent={internalEvent}
      output={output}
      deviceOptions={deviceOptions}
      channelOptions={channelOptions}
      lockIdentityFields={lockIdentityFields}
      onChange={onChange}
    />
  );
}
