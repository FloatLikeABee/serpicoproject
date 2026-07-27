import '@testing-library/jest-dom';

// React 18 under jsdom needs this flag for act() to apply to our updates.
(global as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
