const numberValCommand = (value, length) => {
    const hexValue = (value).toString(16).padStart(length * 2, "0");
    const buffer = Buffer.from(hexValue, 'hex').reverse();
    return buffer.toString("hex");
}

console.log(numberValCommand(11, 2));