module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: '(/__test__/.*|(\\.|/)(test|spec))\\.tsx?$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/types/', '/out/', '/fixtures/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
}
