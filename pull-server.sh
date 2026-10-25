npm run build
git add .
read message
echo "Mensagem do commit: "
git commit -am "$message"
git push teste github
# ssh saadvm@192.168.0.8 \
#   'git -C /home/saadvm/api/ ' \
#   'pull origin master && ' \
#   'pm2 restart api && sudo systemctl restart nginx'
