#!/bin/bash

# 折石ERP 服务管理脚本
# 用法: ./server.sh start|stop|restart|status

APP_DIR="/Users/opikr/Projects/zhes-erp"
PID_FILE="$APP_DIR/data/server.pid"
LOG_FILE="$APP_DIR/data/server.log"

start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "服务已在运行 (PID: $PID)"
            return 0
        fi
        rm -f "$PID_FILE"
    fi

    echo "启动服务..."
    cd "$APP_DIR"
    nohup node temp.js > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "服务已启动 (PID: $PID)"
            return 0
        fi
    fi

    echo "服务启动失败，请检查日志: $LOG_FILE"
    return 1
}

stop() {
    if [ ! -f "$PID_FILE" ]; then
        echo "服务未运行"
        return 0
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "停止服务 (PID: $PID)..."
        kill "$PID"
        sleep 2

        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID"
            sleep 1
        fi
    else
        echo "进程已不存在"
    fi

    rm -f "$PID_FILE"
    echo "服务已停止"
    return 0
}

status() {
    if [ ! -f "$PID_FILE" ]; then
        echo "服务未运行"
        return 1
    fi

    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "服务运行中 (PID: $PID)"
        return 0
    else
        echo "服务已停止 (PID文件存在但进程不存在)"
        rm -f "$PID_FILE"
        return 1
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 1
        start
        ;;
    status)
        status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
