import '@testing-library/jest-dom';

// React 18 needs this flag for act() to be recognised under jsdom.
(global as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
