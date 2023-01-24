const { Command, open } = window.__TAURI__.shell;

console.log(window.__TAURI__);

const DOCKER_COMMAND = 'dockerdjs';
const ARGUMENTS = ['--tlsverify', '-H=docker-digital.vidal.net:2376'];
let containers;
let images;
let imgSearchTo;
let containerSearchTo;
let inspections = {};

function dockerCli(pParams){
  return cli(DOCKER_COMMAND, ARGUMENTS.concat(pParams));
}

function cli(pCommand, pParams){
  return new Promise(async (pResolve, pError)=>{
    let t = new Command(pCommand, pParams);
    let data = [];
    t.stdout.on('data', (pLine)=>data.push(pLine));
    let res = await t.execute();
    pResolve(data.join("\n"));
  });
}

function updateContent(){

  return dockerCli(["ps", "-a"]).then((pContainers)=>{
    return dockerCli(["images"]).then((pImages)=>{
      let parsedImages = parseCLIResult(pImages);
      containers = parseCLIResult(pContainers);
      let named = [];
      images = [];
      parsedImages.forEach((pImage, pIndex)=>{
        let concat_named = pImage['REPOSITORY']+':'+pImage['TAG'];
        pImage.containers = containers.filter((pCtn)=>pCtn['IMAGE'] === pImage['IMAGE ID']||pCtn['IMAGE'] === concat_named);
        pImage.index = pIndex;
        if(pImage["REPOSITORY"].indexOf('user/')>-1){
          named.push(pImage);
          return;
        }
        images.push(pImage);
      });
      named.forEach((pImage)=>{
        let image = images.find((pImg)=>pImg['IMAGE ID'] === pImage['IMAGE ID']);
        let user = pImage['REPOSITORY'].replace("user/", "");
        if(image){
          image.USER = user;
        }else{
          pImage.NO_ROOT_IMG = true;
          pImage.USER = user;
          images.push(pImage);
        }
      });
      images.sort((pA, pB)=>pA.index - pB.index);
      renderImages();
      renderContainers();
    });
  });

}

function renderContainers(){
  let container_search = document.querySelector('#containers .form input[type="search"]');
  let filtered_containers = containers;
  if(container_search.value.length){
    filtered_containers = filtered_containers.filter((pContainer)=>{
      return pContainer.NAMES.indexOf(container_search.value)>-1||pContainer.IMAGE.indexOf(container_search.value)>-1;
    });
  }
  let containers_container = document.querySelector('#containers.list .content .body');
  containers_container.innerHTML = "";
  filtered_containers.forEach((pContainer, pIndex)=>{
    let status = pContainer.STATUS.indexOf('Exited')===0?"offline":"online";
    let oddity = pIndex%2===0?'even':'odd';
    let link = '';
    if(status === 'online'){
      if(inspections[pContainer['CONTAINER ID']]&&inspections[pContainer['CONTAINER ID']].url){
        link = '<a class="button" target="_blank" href="'+inspections[pContainer['CONTAINER ID']].url+'"><i class="icon eye"></i></a>';
      }else{
        link = '<a class="button" onclick="inspectContainer(\''+pContainer['CONTAINER ID']+'\');"><i class="icon eye"></i></a>';
      }
    }
    containers_container.innerHTML += `<div class="row ${oddity}" data-id="${pContainer['CONTAINER ID']}">
      <span class="net_indicator ${status}"></span>
      <span class="checkbox"><input type="checkbox"></span>
      <span class="name"><span class="repo">${pContainer.NAMES}</span><span class="tag">${pContainer.IMAGE}</span></span>
      <span class="link">${link}</span>
      <span class="status">${pContainer.STATUS}</span>
      <span class="created">${pContainer.CREATED}</span>
      </div>`;
  });

  containers_container.querySelectorAll('.row span.checkbox, .row span.name').forEach((pElement)=>{
    pElement.addEventListener('click', (e)=>{
      let cb = e.currentTarget.parentNode.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
    });
  });
  let headers = document.querySelector('#containers.list .content .headers');
  headers.style.paddingRight = (containers_container.offsetWidth - containers_container.clientWidth)+"px";
}

function renderImages(){
  let images_search = document.querySelector('#images .form input[type="search"]');
  let filtered_images = images;
  if(images_search.value.length){
    filtered_images = filtered_images.filter((pImage)=>{
      return pImage.REPOSITORY.indexOf(images_search.value)>-1||pImage.TAG.indexOf(images_search.value)>-1||(pImage.USER&&pImage.USER.indexOf(images_search.value)>-1);
    });
  }
  let images_container = document.querySelector('#images.list .content .body');
  images_container.innerHTML = "";
  filtered_images.forEach((pImage, pIndex)=>{
    let oddity = pIndex%2===0?'even':'odd';
    let container = pImage.containers.length?'<a class="button" onclick="displayBox(renderBoxContainers(\''+pImage['IMAGE ID']+'\'));">'+pImage.containers.length+'</a>':pImage.containers.length;
    images_container.innerHTML += `<div class="row ${oddity}" data-id="${pImage['IMAGE ID']}">
      <span class="checkbox"><input type="checkbox"></span>
      <span class="name"><span class="repo">${pImage.REPOSITORY}</span><span class="tag">${pImage.TAG}</span></span>
      <span class="containers">${container}</span>
      <span class="created">${pImage.CREATED}</span>
      <span class="user">${pImage.USER||''}</span>
      <span class="size">${pImage.SIZE}</span>
      </div>`;
  });

  images_container.querySelectorAll('.row span.checkbox, .row span.name').forEach((pElement)=>{
    pElement.addEventListener('click', (e)=>{
      let cb = e.currentTarget.parentNode.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
    });
  });

  let headers = document.querySelector('#images.list .content .headers');
  headers.style.paddingRight = (images_container.offsetWidth - images_container.clientWidth)+"px";
}

function parseCLIResult(pString){
  let lines = pString.split("\n");
  let headerLine = lines[0];
  let headers = [];
  let re = /([a-z0-9A-Z]+(\s[a-z0-9A-Z]+)*\s+)/gi;
  let col;
  let idx = 0;
  do{
    col = re.exec(headerLine);
    if(col){
      let name = col[1].trim();
      idx += col[1].length;
      headers.push({"name":name, "length":col[1].length});
    }
  }
  while (col);

  if(idx < headerLine.length){
    let last = headerLine.substring(idx);
    headers.push({name: last.trim(), length: headerLine.length - idx});
  }

  let results = [];

  for(let i = 1, max = lines.length; i<max; i++){
    let line = lines[i];
    if(!line.trim().length){
      continue;
    }
    let entry = {};
    let idx = 0;
    headers.forEach((pCol, pIndex)=>{
      let val = pIndex===headers.length-1?line.substring(idx):line.substring(idx, idx + pCol.length);
      entry[pCol.name] = val.trim().replace("<", "&lt;").replace(">", "&gt;");
      idx += pCol.length;
    });
    results.push(entry);
  }
  return results;
}

window.displayBox = function(pHtml){
  if(pHtml===false){
    document.querySelector('#box_overlay').classList.remove('displayed');
    return;
  }
  document.querySelector('#box_overlay').classList.add('displayed');
  document.querySelector('#box_content').innerHTML = pHtml;
}
window.renderBoxContainers = function(pId){
  let img = images.find((pImg)=>pImg['IMAGE ID'] === pId);
  if(!img || !img.containers.length){
    return false;
  }
  let list = '';
  img.containers.forEach((pCtn)=>{
    let status = pCtn.STATUS.indexOf('Exited')===0?"offline":"online";
    let see = pCtn.STATUS.indexOf('Exited')===0?"":"<a class='button' onclick='inspectContainer(\""+pCtn["CONTAINER ID"]+"\")'><i class='icon eye'></i></a>";
    let killAction = pCtn.STATUS.indexOf('Exited')===0?"":`<a class="button" onclick="killContainer('${pCtn["CONTAINER ID"]}').then(()=>{displayBox(renderBoxContainers('${pId}'));})"><i class="icon stop"></i></a>`;
    list += `
    <div class="row">
        <span class="net_indicator ${status}"></span>
        <span class="name">${pCtn.NAMES}</span>
        <div class="actions">${see}${killAction}
        <a class="button" onclick="restartContainer('${pCtn["CONTAINER ID"]}').then(()=>{displayBox(renderBoxContainers('${pId}'));})"><i class="icon play"></i></a>
        <a class="button" onclick="rmContainer('${pCtn["CONTAINER ID"]}').then(()=>{displayBox(renderBoxContainers('${pId}'));})"><i class="icon remove"></i></a></div>
    </div>
    `;
  });

  return `
  <h1>${img['REPOSITORY']}:${img['TAG']}</h1>
  <div class="list">
  ${list}
</div>
  `;
}

function toggleTabHandler(e){
  const current = document.querySelector('#container>.side .current');
  const container = document.querySelector('#'+current.getAttribute("data-tab"));
  current.classList.remove("current");
  container.classList.remove("current");
  let t = e.currentTarget;
  t.classList.add("current");
  document.querySelector('#'+t.getAttribute("data-tab")).classList.add("current");
}

function getSelectedImages(){
  return getSelectedRowsIds('#images');
}

function getSelectedContainers(){
  return getSelectedRowsIds('#containers');
}

function getSelectedRowsIds(pParentSelector){
  let toRm = document.querySelectorAll(pParentSelector+' .content .body input[type="checkbox"]:checked');
  if(!toRm.length){
    return;
  }

  let ids = [];
  toRm.forEach((pEl)=>{
    ids.push(pEl.parentNode.parentNode.getAttribute("data-id"));
  });
  return ids;
}

function rmImagesHandler(e){
  let id_images = getSelectedRowsIds('#images');
  return dockerCli(["rmi", "-f"].concat(id_images)).then(updateContent);
}

function rmContainersHandler(e){
  let id_containers = getSelectedRowsIds('#containers');
  return rmContainer(id_containers.join(" "));
}

function killContainersHandler(e){
  let id_containers = getSelectedRowsIds('#containers');
  return killContainer(id_containers.join(" "));
}

function restartContainersHandler(e){
  let id_containers = getSelectedRowsIds('#containers');
  return restartContainer(id_containers.join(" "));
}

window.rmContainer = function(pId){
  return dockerCli(["rm", "-f", pId]).then(updateContent);
}
window.killContainer = function (pId){
  return dockerCli(["kill", pId]).then(updateContent);
}
window.restartContainer = function (pId){
  return dockerCli(["restart", pId]).then(updateContent);
}
window.inspectContainer = function(pId){
  if(inspections[pId]){
    renderContainers();
    open(inspections[pId].url);
    return;
  }
  return dockerCli(["inspect", pId]).then((pData)=>{
    let data = JSON.parse(pData);
    let env = {};
    data[0].Config.Env.forEach((pEnv)=>{
      let [key, val] = pEnv.split("=");
      env[key] = val;
    });
    if(env.LETSENCRYPT_HOST){
      env.LETSENCRYPT_HOST = "https://"+env.LETSENCRYPT_HOST;
    }
    if(env.VIRTUAL_HOST){
      env.VIRTUAL_HOST = "http://"+env.VIRTUAL_HOST;
    }
    inspections[pId] = {
      "raw":data[0],
      "env":env,
      "url":env.LETSENCRYPT_HOST||env.VIRTUAL_HOST
    };
    renderContainers();
    open(inspections[pId].url);
  });
}

function imageSearchkeyUpHandler(e){
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  if(imgSearchTo){
    clearTimeout(renderImages);
  }
  imgSearchTo = setTimeout(renderImages, 250);
}
function containerSearchkeyUpHandler(e){
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  if(containerSearchTo){
    clearTimeout(renderContainers);
  }
  containerSearchTo = setTimeout(renderContainers, 250);
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('#container>.side *[data-tab]').forEach((pElement)=>{
    pElement.addEventListener('click', toggleTabHandler);
  });
  updateContent();
  document.querySelector('#images .form #images_reload').addEventListener('click', updateContent);
  document.querySelector('#images .form #images_rm').addEventListener('click', rmImagesHandler);
  document.querySelector('#images .form input[type]').addEventListener('keyup', imageSearchkeyUpHandler);
  document.querySelector('#images .form input[type]').addEventListener('search', imageSearchkeyUpHandler);
  document.querySelector('#containers .form #containers_reload').addEventListener('click', updateContent);
  document.querySelector('#containers .form #containers_rm').addEventListener('click', rmContainersHandler);
  document.querySelector('#containers .form #containers_restart').addEventListener('click', restartContainersHandler);
  document.querySelector('#containers .form #containers_kill').addEventListener('click', killContainersHandler);
  document.querySelector('#containers .form input[type]').addEventListener('keyup', containerSearchkeyUpHandler);
  document.querySelector('#containers .form input[type]').addEventListener('search', containerSearchkeyUpHandler);
  //document.addEventListener('contextmenu', (e)=>e.preventDefault());
});
