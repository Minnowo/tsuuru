#!/bin/bash
docker run --rm -it \
    -v ".:/workspace" \
    -p "5174:5173" \
    npm-dev:latest bash

