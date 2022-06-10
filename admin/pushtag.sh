#!/bin/sh
set -ue
cd -- "`dirname -- "$0"`"

if [ $# -ne 2 ]
then
	echo "usage: $0 <tag> <message>"
	exit
fi

git tag -a "${1:?}" -m "${2:?}"
git push origin --tags
