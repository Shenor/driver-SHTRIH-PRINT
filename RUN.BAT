:: This example run script

node.exe server.js "0.0.0.0:50505:2005:192.168.1.202:1111" 1>> "%Date:~6,4%%Date:~3,2%%Date:~0,2%_out.log" 2>>&1

:: not log
:: node.exe server.js "0.0.0.0:50505:2005:192.168.1.202:1111" 1>> NUL 2>>&1

pause