
## как запустить сервачок
* закачать radmin vpn на оба компа

**https://www.radmin-vpn.com/**

* создать там сеть и зайти в неё

* открыть порт 8000 (powershell)
```powershell
  New-NetFirewallRule -DisplayName "Chat Server 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```



* сервачок запускаем очевидно

`python server.py --host 0.0.0.0 --port 8000`

страничка админки

`http://localhost:8000/admin/`


## проверить коннекшен
[logo]: https://github.com/dailycloud/huh-yeah/blob/main/readme/image.png "Logo Title Text 2"
```bash
ping <ip>
```


# клиентеек
`python client.py --port 8000`

на запуске попросит адрес

`http://адрес-сервера:8000`


# 



