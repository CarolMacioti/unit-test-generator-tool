export interface PropInfo {
  name: string;
  type: string;
  optional: boolean;
}

export interface TestScenario {
  type:
    | 'snapshot'
    | 'callback'
    | 'optional'
    | 'event'
    | 'state'
    | 'conditional';
  description: string;
  propName?: string;
  eventName?: string;
}

export interface ComponentAnalysis {
  componentName: string;
  props: PropInfo[];
  hooks: string[];
  events: string[];
  dependencies: string[];
  stateVariables: string[];
  hasConditionalRender: boolean;
  testScenarios: TestScenario[];
}
