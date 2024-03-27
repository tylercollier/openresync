# Docker

This project is published on Docker Hub at [`ckeeney/openresync`](https://hub.docker.com/repository/docker/ckeeney/openresync).  

A [config file](https://github.com/tylercollier/openresync#configuration) must be mounted into the container at `/app/config/config.js`.  If you mount a whole directory at `/app/config/`, you will have easy access to the files written to `/app/config` by [`openresync`](https://github.com/tylercollier/openresync).  Additionally, you can mount a directory at `/app/logs` to have easy access to the [`openresync`](https://github.com/tylercollier/openresync) logs.  

## Permissions
By default, the node process runs as the `node` user, with `UID = 1000` and `GID = 1000`.  The container-user running the process must have write-access to the files and folders mounted into the container.  This can be accomplished in at least two ways:

### 1. Change user that runs the node process
Changing the user that runs the node process to match your host user ensures you can still easily edit the config file without juggling permissions.

First find your own `UID` and `GID`:
```shell
echo $UID : $GID
1000 : 1001
```

Tell docker or `docker-compose` to use these UID and GID to run the process.  With docker, you can do this by adding `-u 1000:1001` to your run command.  With `docker-compose`, add a `user: 1000:1001` property to the service.

### 2. Change ownership on the host
On the host, you can run
```shell
chown -R ./volumes/openresync/config 1000:1000
```

You may lose write access to the config file if you do this.

If `UID` or `GID` 1000 exist on your host machine, you will see the username and groupname that have `ID = 1000`.

If you do not have a user or group on your machine with `ID = 1000`, you will just see `1000:1000` as the owner of the files and directories.


## Example docker-compose
```yaml
version: '3.7'
  openresync:
    image: ckeeney/openresync
    restart: always

    # properly handles kernel signals for faster restarts and shutdowns.  
    # see https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals 
    init: true
    
    # run as my UID/GID
    user: 1000:1001

    # expose web service
    ports:
      - 4000:4000
    # pass in some data to my own config file 
    environment: 
      TRESTLE_CLIENT_ID: <SECRET>
      TRESTLE_CLIENT_SECRET: <SECRET>
      DB_CONN_STRING_TRESTLE: mysql://devuser:devpass@mysql:3306/re-data
      DB_CONN_STRING_STATS: mysql://devuser:devpass@mysql:3306/re-data
      
    # mount the directories
    volumes:
      - ./volumes/openresync/config:/app/config
      - ./volumes/openresync/logs:/app/logs
    depends_on:
      - mysql

  # any db provider 
  mysql:
    image: mysql:8.0
    restart: always
    ports:
      - 3306:3306
    environment:
      MYSQL_RANDOM_ROOT_PASSWORD: yespls
      MYSQL_DATABASE: re-data
      MYSQL_USER: devuser
      MYSQL_PASSWORD: devpass
    volumes:
      - ./volumes/mysql:/var/lib/mysql
```
