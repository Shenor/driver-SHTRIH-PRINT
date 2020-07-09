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
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) {
    throw Error('Значение передаваемое функции numberValCommand должно быть числом');
  }
  const hexValue = (parsedValue).toString(16).padStart(length * 2, "0");
  const buffer = Buffer.from(hexValue, 'hex').reverse();
  return buffer.toString("hex");
}

//** Задаем переменные необходимые для команды записи в ПЛУ */
const pass = stringCommand("0030", 4);
const name2 = stringCommand("", 28);
const tara = numberValCommand(0, 2);
const groupCode = numberValCommand(1, 2)
const numImage = numberValCommand(0, 1);
const rosStet = numberValCommand(10, 4);

xmlParser.parse((err, products) => {
  if(err) {throw Error(err)}

  products.forEach(({code, name, price, period, instruct}, idx) => {
    setTimeout(() => {
        const numberPLU = numberValCommand(code, 2); // из XML значения приходят в строке - из надо парсить в число
        const codeProduct = numberValCommand(code, 4);
        const nameProduct = stringCommand(name, 28);
        const priceProduct = numberValCommand(price, 4);
        const periodProduct = numberValCommand(period, 2)
        const instructProduct = iconv.decode(Buffer.from(instruct, 'base64'), 'win1251').slice(0, 400);

        /** Message sending Function */
        let sybomCount = 0,
          stringCount = 1;

        while (instructProduct.slice(sybomCount, sybomCount + 50) != "") {
          const writeMessage = Buffer.from(`02${(58).toString(16)}52${pass}${numberPLU}${numberValCommand(stringCount, 1)}${stringCommand(instructProduct.slice(sybomCount, sybomCount + 50), 50)}`, 'hex');

          setTimeout(() => {
            serverUDP.send(writeMessage, scalesUDPport, scalesUDPip);
          }, sybomCount + 100); //Из-за ограничений протокола UDP необходимо ставить таймауты, что бы пакеты доходили

          sybomCount += 50;
          stringCount++;
        }

        const sing = Buffer.from(`02${(84).toString(16)}50${pass}${numberPLU}${codeProduct}${nameProduct}${name2}${priceProduct}${periodProduct}${tara}${groupCode}${numberPLU}${numImage}${rosStet}`, 'hex');
        console.log('_____________________\n')
        serverUDP.send(sing, scalesUDPport, scalesUDPip);
        console.log(sing);
        console.log(sing.length - 2);

    }, (idx + 1) * 500);
  });
  
});

serverHTTP.close();

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
// Заполняя товары необходимо указывать название код и состав, иначе выгрузка из XML не увидит товары