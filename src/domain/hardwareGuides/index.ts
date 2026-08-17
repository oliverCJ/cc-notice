import { DeviceChannelActionType } from '@/api/tauriApi';

export type HardwareGuideId =
  | 'digital-output'
  | 'pwm-output'
  | 'buzzer'
  | 'addressable-led';

export type HardwareGuide = {
  id: HardwareGuideId;
  titleKey: string;
  summaryKey: string;
  suitableHardwareKeys: string[];
  recommendedScenarioKeys: string[];
  wiringKeys: string[];
  electricalSpecKeys: string[];
  electricalNoticeKeys: string[];
  supportedActions: DeviceChannelActionType[];
  testStepKeys: string[];
  faqKeys: string[];
};

export const hardwareGuides: Record<HardwareGuideId, HardwareGuide> = {
  'digital-output': {
    id: 'digital-output',
    titleKey: 'hardwareGuides.digitalOutput.title',
    summaryKey: 'hardwareGuides.digitalOutput.summary',
    suitableHardwareKeys: [
      'hardwareGuides.digitalOutput.hardware.led',
      'hardwareGuides.digitalOutput.hardware.relay'
    ],
    recommendedScenarioKeys: [
      'hardwareGuides.digitalOutput.scenarios.status',
      'hardwareGuides.digitalOutput.scenarios.trigger'
    ],
    wiringKeys: [
      'hardwareGuides.digitalOutput.wiring.pin',
      'hardwareGuides.digitalOutput.wiring.ground'
    ],
    electricalSpecKeys: [
      'hardwareGuides.electrical.gpioVoltage',
      'hardwareGuides.electrical.gpioCurrentConservative',
      'hardwareGuides.electrical.ledResistor',
      'hardwareGuides.electrical.sharedGround'
    ],
    electricalNoticeKeys: [
      'hardwareGuides.digitalOutput.notices.resistor',
      'hardwareGuides.digitalOutput.notices.current'
    ],
    supportedActions: ['activate', 'deactivate', 'blink', 'breathe', 'pulse'],
    testStepKeys: [
      'hardwareGuides.digitalOutput.tests.connect',
      'hardwareGuides.digitalOutput.tests.activate'
    ],
    faqKeys: ['hardwareGuides.digitalOutput.faq.inverted']
  },
  'pwm-output': {
    id: 'pwm-output',
    titleKey: 'hardwareGuides.pwmOutput.title',
    summaryKey: 'hardwareGuides.pwmOutput.summary',
    suitableHardwareKeys: [
      'hardwareGuides.pwmOutput.hardware.led',
      'hardwareGuides.pwmOutput.hardware.driver'
    ],
    recommendedScenarioKeys: [
      'hardwareGuides.pwmOutput.scenarios.brightness',
      'hardwareGuides.pwmOutput.scenarios.fade'
    ],
    wiringKeys: [
      'hardwareGuides.pwmOutput.wiring.pin',
      'hardwareGuides.pwmOutput.wiring.ground'
    ],
    electricalSpecKeys: [
      'hardwareGuides.electrical.gpioVoltage',
      'hardwareGuides.electrical.gpioCurrentConservative',
      'hardwareGuides.electrical.ledResistor',
      'hardwareGuides.electrical.driverRequired'
    ],
    electricalNoticeKeys: [
      'hardwareGuides.pwmOutput.notices.driver',
      'hardwareGuides.pwmOutput.notices.frequency'
    ],
    supportedActions: ['set-duty', 'pulse', 'breathe', 'clear'],
    testStepKeys: [
      'hardwareGuides.pwmOutput.tests.duty',
      'hardwareGuides.pwmOutput.tests.clear'
    ],
    faqKeys: ['hardwareGuides.pwmOutput.faq.flicker']
  },
  buzzer: {
    id: 'buzzer',
    titleKey: 'hardwareGuides.buzzer.title',
    summaryKey: 'hardwareGuides.buzzer.summary',
    suitableHardwareKeys: [
      'hardwareGuides.buzzer.hardware.active',
      'hardwareGuides.buzzer.hardware.passive'
    ],
    recommendedScenarioKeys: [
      'hardwareGuides.buzzer.scenarios.failure',
      'hardwareGuides.buzzer.scenarios.permission'
    ],
    wiringKeys: ['hardwareGuides.buzzer.wiring.pin', 'hardwareGuides.buzzer.wiring.ground'],
    electricalSpecKeys: [
      'hardwareGuides.electrical.gpioVoltage',
      'hardwareGuides.electrical.gpioCurrentConservative',
      'hardwareGuides.electrical.driverRequired',
      'hardwareGuides.electrical.sharedGround'
    ],
    electricalNoticeKeys: [
      'hardwareGuides.buzzer.notices.current',
      'hardwareGuides.buzzer.notices.volume'
    ],
    supportedActions: ['beep', 'tone', 'clear'],
    testStepKeys: ['hardwareGuides.buzzer.tests.beep', 'hardwareGuides.buzzer.tests.tone'],
    faqKeys: ['hardwareGuides.buzzer.faq.silent']
  },
  'addressable-led': {
    id: 'addressable-led',
    titleKey: 'hardwareGuides.addressableLed.title',
    summaryKey: 'hardwareGuides.addressableLed.summary',
    suitableHardwareKeys: [
      'hardwareGuides.addressableLed.hardware.strip',
      'hardwareGuides.addressableLed.hardware.ring'
    ],
    recommendedScenarioKeys: [
      'hardwareGuides.addressableLed.scenarios.richStatus',
      'hardwareGuides.addressableLed.scenarios.multiDevice'
    ],
    wiringKeys: [
      'hardwareGuides.addressableLed.wiring.data',
      'hardwareGuides.addressableLed.wiring.power',
      'hardwareGuides.addressableLed.wiring.ground'
    ],
    electricalSpecKeys: [
      'hardwareGuides.electrical.gpioVoltage',
      'hardwareGuides.electrical.ws2812DataResistor',
      'hardwareGuides.electrical.ws2812Power',
      'hardwareGuides.electrical.ws2812Level'
    ],
    electricalNoticeKeys: [
      'hardwareGuides.addressableLed.notices.power',
      'hardwareGuides.addressableLed.notices.level'
    ],
    supportedActions: ['set-color', 'clear'],
    testStepKeys: [
      'hardwareGuides.addressableLed.tests.color',
      'hardwareGuides.addressableLed.tests.brightness'
    ],
    faqKeys: ['hardwareGuides.addressableLed.faq.colorOrder']
  }
};

export function getHardwareGuide(guideId?: string | null): HardwareGuide | null {
  if (!guideId || !(guideId in hardwareGuides)) {
    return null;
  }
  return hardwareGuides[guideId as HardwareGuideId];
}
