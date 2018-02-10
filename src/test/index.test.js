describe('index', () => {
  it('Just logs main', () => {
    let output = '';
    let storeLog = inputs => {
      output += inputs;
    };
    const log = jest.fn(storeLog);
    console.log = log;
    require('../main/index');
    expect(output).toMatchSnapshot();
  });
});
