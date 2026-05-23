export default {
  displayName: 'marketing-infrastructure',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]s$': ['@swc/jest', { jsc: { target: 'es2021' } }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/marketing-infrastructure',
};
