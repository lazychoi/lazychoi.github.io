const { lookup } = require('@seyoungsong/hanjadict');

const testChars = ['侩', '儈', '叏', '哙', '筷'];
testChars.forEach(c => {
  console.log(`${c} -> ${lookup(c)}`);
});
