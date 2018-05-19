FROM docker.in.ruguoapp.com/node:8.9-onbuild
ENV TZ Asia/Shanghai
ENTRYPOINT ["npm", "run"]
CMD ["start"]
