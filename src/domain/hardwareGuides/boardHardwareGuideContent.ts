import { HardwareGuide } from './index';

export type BoardHardwareGuideContent = {
  electricalSpecKeys: string[];
  electricalNoticeKeys: string[];
};

export function getBoardHardwareGuideContent(
  boardId: string | null | undefined,
  guide: HardwareGuide
): BoardHardwareGuideContent {
  if (boardId === 'arduino-uno' || boardId === 'arduino-nano') {
    return {
      electricalSpecKeys: replaceGpioVoltageKey(guide.electricalSpecKeys, 'hardwareGuides.electrical.arduinoGpioVoltage'),
      electricalNoticeKeys: [
        ...guide.electricalNoticeKeys,
        'hardwareGuides.arduinoTinyAvr.notices.outputRange',
        'hardwareGuides.arduinoTinyAvr.notices.pwmPins',
        'hardwareGuides.arduinoTinyAvr.notices.reservedPins'
      ]
    };
  }

  return {
    electricalSpecKeys: guide.electricalSpecKeys,
    electricalNoticeKeys: guide.electricalNoticeKeys
  };
}

function replaceGpioVoltageKey(keys: string[], nextKey: string): string[] {
  return keys.map((key) => (key === 'hardwareGuides.electrical.gpioVoltage' ? nextKey : key));
}
