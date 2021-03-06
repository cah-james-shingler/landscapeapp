set -e
rm -rf dist || true
mkdir -p dist

# uncomment below when about to test a googlebot rendering
# echo '<head><meta name="google-site-verification" content="27ZKkPQS2PWkd_0jqsSq4yUgUZ_BBTYjABudtQpMhXI" /></head>' > dist/index.html
npm install -g npm
npm ci
bash build.sh LFDLFoundation/lfdl-landscape lfdl
bash build.sh cncf/landscape cncf
echo "User-agent: *" > dist/robots.txt
# comment below when about to test a googlebot rendering
echo "Disallow: /" >> dist/robots.txt

# This will increase a version and publish to an npm
# If there is an existing package
if [ $BRANCH = "master" ]; then
  git config --global user.email "info@cncf.io"
  git config --global user.name "CNCF-bot"
  git remote rm github 2>/dev/null || true
  git remote add github "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/cncf/landscapeapp"
  git fetch github
  git diff
  git checkout -- .
  npm version patch
  git commit -m 'Update to a new version [skip ci]' --allow-empty --amend
  git branch -D tmp || true
  git checkout -b tmp
  git push github HEAD:master
  git push github HEAD:master --tags --force
  echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc
  git diff
  npm publish || (sleep 5 && npm publish) || (sleep 30 && npm publish)
  curl -X POST -d {} https://api.netlify.com/build_hooks/5c1bd8e14ed62f166e8d9f7f
  curl -X POST -d {} https://api.netlify.com/build_hooks/5c1bd968fdd72a78a54bdcd1
fi
