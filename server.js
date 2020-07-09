const fs        = require('fs');
const http      = require('http');
const dgram     = require('dgram');
const serverUDP = dgram.createSocket('udp4');
const iconv     = require('iconv-lite');
const htmlparser2 = require("htmlparser2");
const xmlParser = require('./parse');

var globalWeight = 0;

var configString   = ((process.argv.length < 3) ? "0.0.0.0:50505:2005:192.168.1.202:1111" : process.argv[2]).split(":");
var serverHTTPip   = configString[0];
var serverHTTPport = configString[1];
var serverUDPport  = configString[2];
var scalesUDPip    = configString[3];
var scalesUDPport  = configString[4];

serverUDP.on('error', (err) => {
  console.log((new Date()).toTimeString(), ` UDP server error:\n${err.stack}`);
  serverUDP.close();
});

serverUDP.on('message', (msg, rinfo) => {
  console.log((new Date()).toTimeString(), ` UDP server got:`, msg, `from ${rinfo.address}:${rinfo.port}`);
  if (msg[0] == 0x2) {
	  globalWeight = (Buffer.from([msg[4], msg[5]])).readInt16LE(0);
	  // console.log((new Date()).toTimeString(), ' UDP server get weight OK ' + globalWeight);
  } else console.log((new Date()).toTimeString(), ' UDP server get weight ERR');
});

serverUDP.on('listening', () => {
  const address = serverUDP.address();
  console.log((new Date()).toTimeString(), ` UDP server running ${address.address}:${address.port}`);
});

serverUDP.bind(serverUDPport);

//** Создание HTTP сервера */
const serverHTTP = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset = utf-8');
  res.end("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Scale><Weight>" + globalWeight + "</Weight><ErrorText>Overweight</ErrorText></Scale>\n");
});

serverHTTP.listen(serverHTTPport, serverHTTPip, () => {
  console.log((new Date()).toTimeString(), `HTTP server running at http://${serverHTTPip}:${serverHTTPport}/`);
});


// setInterval(function () {
//   getWeightMsg = Buffer.from('02053830303330', 'hex');
//   serverUDP.send(getWeightMsg, scalesUDPport, scalesUDPip);
//   console.log((new Date()).toTimeString(), " UDP server send: ", getWeightMsg);
// }, 1000);

/** Эта команда принимает текстовые значения и переводит их 
 * в формат протокола для стандарта RS-232C */

const stringCommand = ( bufferValue, bufferLength ) => {
  if (bufferLength == 1) { throw Error('Value must be > 1')}
  const stringBuffer = iconv.encode(bufferValue, 'win1251');
  if (bufferLength - stringBuffer.length < 0) {throw Error('Длинна сообщения превышает допустимое значение' + bufferLength);}
  const emptyBuffer = Buffer.alloc(bufferLength - stringBuffer.length);
  const newBuffer = Buffer.concat([stringBuffer, emptyBuffer]);
  return newBuffer.toString('hex');
};

/** Эта команда принимает числовые значения и переводит их 
 * в формат протокола для стандарта RS-232C */

const numberValCommand = (value, length) => {
  const hexValue = (value).toString(16).padStart(length * 2, "0");
  const buffer = Buffer.from(hexValue, 'hex').reverse();
  return buffer.toString("hex");
}

xmlParser.parse((err, products) => {
  if(err) {throw Error(err)}

  console.log(products);
});

//** Задаем переменные необходимые для команды записи в ПЛУ */
const lengthMSG = (84).toString(16);
const pass      = stringCommand("0030", 4);
const numberPLU = numberValCommand(1, 2);
const code      = numberValCommand(1, 4);
const name      = stringCommand("Гачимучи_вэн", 28);
const name2     = stringCommand("", 28);
const price     = numberValCommand(2000, 4);
const period    = numberValCommand(5, 2);
const tara      = numberValCommand(0, 2);
const groupCode = numberValCommand(1, 2)
const numMsg    = numberValCommand(1, 2);
const numImage  = numberValCommand(0, 1);
const rosStet   = numberValCommand(10, 4);

/** Message sending Procedure */
let sybomCount = 0,
  stringCount = 1;

// const text = `Передаю привет всем моим подпищикам, кидаю лайкус12345678912345678912345678 третья строка пойдёт сейчас когда пойдёт четвёртая я не знаю а так играю. Играю в доту с пацанами мне кричат жапаузынды я игнорю и хукаю, во даете пацаны!`.slice(0, 400);

// while (text.slice(sybomCount, sybomCount + 50) != "") {
//         const writeMessage = Buffer.from(`02${(58).toString(16)}52${pass}${numberPLU}${numberValCommand(stringCount, 1)}${stringCommand(text.slice(sybomCount, sybomCount + 50), 50)}`, 'hex');

//         setTimeout(() => {
//           serverUDP.send(writeMessage, scalesUDPport, scalesUDPip);
//         }, sybomCount + 100);

//         console.log(stringCount)
//         console.log(text.slice(sybomCount, sybomCount + 50));

//         sybomCount += 50;
//         stringCount++;
// }

// const sing = Buffer.from(`02${lengthMSG}50${pass}${numberPLU}${code}${name}${name2}${price}${period}${tara}${groupCode}${numMsg}${numImage}${rosStet}`, 'hex');
// const sing = Buffer.from(`02ff55${pass}${numberValCommand(1, 1)}${numberValCommand(1, 2)}${code}${name}${name2}${price}${period}${tara}${groupCode}${numberPLU}${numImage}${rosStet}080720`, 'hex');
// console.log(sing);
// console.log(sing.length - 2);
// serverUDP.send(sing, scalesUDPport, scalesUDPip);

/* Instuction */

//Алгоритм
//  В общем каждая команда строится по такому шаблону:
// -> Байт 0: признак начаал сообщения по умолчанию он равен '02';
// -> Байт 1: длинна сообщения, передается в HEX;
// -> Байт 2: Номер команды
// Все последующие байты зависят от команды. см. документацию Протокол обмена весов «Штрих-Принт».


//  Если это строка:
// -> Переводим строку в звкодированный буффер(windows-1251) => iconv.encode(bufferValue, 'win1251');
// -> Создаем пустой буффер с заданным размером (Например нам нужен буфер размеров 28 бит, 
//    мы на основе строки создаем буфер см.выше и создаем второй буфер равный 28 - длинна буфера строки) => Buffer.alloc(bufferLength - stringBuffer.length);
// -> Далее конкатенируем буфферы, оставшиеся байты заполняются нулями. 
//    В итоге у нас буфер заданного размера где в начале идет значение, 
//    а конец буфера недостающие нуля для создания буфера необходимой длинны. => Buffer.concat([stringBuffer, emptyBuffer])
// -> Возвращается новый буффер и переводится в HEX => return value.toString('HEX');
//
//  Если это число:
// -> Переводим в 16-ричный формат => (value).toString(16)
// -> Добавляем необходимое кол-во нулей достижения необходимой длинны команды => padStart(length * 2, "0");
// -> Создае буффер из строки выше в hex и переворачиваем его => Buffer.from(hexValue, 'hex').reverse();
//
//==> Пароли передаются в виде "0030" => "30 30 33 30" (toString('hex'))