const iconv = require('iconv-lite');

const str = 'weXr6ugtMTU7ICDG6PD7LTEwOyDT4+vl4u7k+y0yMjE7INHu8fLg4jogzO7w6u7i6uAsINDl5Ojx6uAsIM/u7Ojk7vDq6Cwg0eDr4PLo6iDxIOrg7/Px8u7pIO3uIO3lIOrw4PHt++k=';
const buf = iconv.decode(Buffer.from(str, 'base64'), 'win1251');

console.log(buf);