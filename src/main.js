import {STATE_ERROR, STATE_IN_PROGRESS, STATE_VALID, StepProgress} from "./scripts/StepProgress.js";

const { Command, open } = window.__TAURI__.shell;
const openDialog  = window.__TAURI__.dialog.open;
const { sep } = window.__TAURI__.path;
const { BaseDirectory, exists, readTextFile, writeTextFile } = window.__TAURI__.fs;

const DOCKER_COMMAND = 'dockerdjs';
const CONFIG_FILE = "dockerdjs.conf";
let user = 'unknown';
let docker_arguments = ['--tlsverify', '-H=docker-digital.vidal.net:2376'];
let docker_envs = [{'label':'VIRTUAL_HOST', 'value':'{value}.ama-doc.vidal.fr'}, {'label':'LETSENCRYPT_HOST', 'value':'{value}.ama-doc.vidal.fr'}];
let working_dirs = [];
let running_recycle = false;
let working_dir_index = 0;
let working_dir_progress;
let imgSearchTo;
let containerSearchTo;
let inspections = {};
let listScreen = {
  'containers':{
    'data':[],
    'dockerArgs':['ps', '-a'],
    'emptyMessage':'Aucun conteneur',
    'filter':(pContainer, pVal)=>{
      return pContainer.NAMES.indexOf(pVal)>-1||pContainer.IMAGE.indexOf(pVal)>-1;
    },
    'renderRow':(pContainer, pIndex)=>{
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
      return `<div class="row ${oddity}" data-id="${pContainer['CONTAINER ID']}">
      <span class="net_indicator ${status}"></span>
      <span class="checkbox"><input type="checkbox"></span>
      <span class="name"><span class="repo">${pContainer.NAMES}</span><span class="tag">${pContainer.IMAGE}</span></span>
      <span class="link">${link}</span>
      <span class="status">${pContainer.STATUS}</span>
      <span class="created">${pContainer.CREATED}</span>
      </div>`;
    }
  },
  'images':{
    'data':[],
    'dockerArgs':['images'],
    'emptyMessage':'Aucune image',
    'filter':(pImage, pVal)=>{
      return pImage.REPOSITORY.indexOf(pVal)>-1||pImage.TAG.indexOf(pVal)>-1||(pImage.USER&&pImage.USER.indexOf(pVal)>-1);
    },
    'renderRow':(pImage, pIndex)=>{
      let oddity = pIndex%2===0?'even':'odd';
      let container = pImage.containers.length?'<a class="button" onclick="displayBox(renderBoxContainers(\''+pImage['IMAGE ID']+'\'));">'+pImage.containers.length+'</a>':pImage.containers.length;
      return `<div class="row ${oddity}" data-id="${pImage['IMAGE ID']}">
      <span class="checkbox"><input type="checkbox"></span>
      <span class="name"><span class="repo">${pImage.REPOSITORY}</span><span class="tag">${pImage.TAG}</span></span>
      <span class="containers">${container}</span>
      <span class="created">${pImage.CREATED}</span>
      <span class="user">${pImage.USER||''}</span>
      <span class="size">${pImage.SIZE}</span>
      </div>`;
    }
  }
};

function dockerCli(pParams){
  return cli(DOCKER_COMMAND, docker_arguments.concat(pParams));
}

function cli(pCommand, pParams){
  console.log("Running : "+pCommand+" "+(pParams?pParams.join(" "):''));
  return new Promise(async (pResolve)=>{
    let t = new Command(pCommand, pParams);
    let data = [];
    t.stdout.on('data', (pLine)=>data.push(pLine));
    let res = await t.execute();
    pResolve([data.join("\n"), res.code!==0]);
  });
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

function updateContent(){
  let promises = [];
  for(let k in listScreen){
    if(!listScreen.hasOwnProperty(k)){
      continue;
    }
    promises.push(dockerCli(listScreen[k].dockerArgs));
  }
  return Promise.all(promises).then((pVals)=>{
    listScreen.containers.data = parseCLIResult(pVals[0][0]);
    let parsedImages = parseCLIResult(pVals[1][0]);
    let named = [];
    listScreen.images.data = [];
    parsedImages.forEach((pImage, pIndex)=>{
      let concat_named = pImage['REPOSITORY']+':'+pImage['TAG'];
      pImage.containers = listScreen.containers.data.filter((pCtn)=>pCtn['IMAGE'] === pImage['IMAGE ID']||pCtn['IMAGE'] === concat_named);
      pImage.index = pIndex;
      if(pImage["REPOSITORY"].indexOf('user/')>-1){
        named.push(pImage);
        return;
      }
      listScreen.images.data.push(pImage);
    });
    named.forEach((pImage)=>{
      let image = listScreen.images.data.find((pImg)=>pImg['IMAGE ID'] === pImage['IMAGE ID']);
      let user = pImage['REPOSITORY'].replace("user/", "");
      if(image){
        image.USER = user;
      }else{
        pImage.NO_ROOT_IMG = true;
        pImage.USER = user;
        listScreen.images.data.push(pImage);
      }
    });
    listScreen.images.data.sort((pA, pB)=>pA.index - pB.index);
    for(let k in listScreen){
      if(!listScreen.hasOwnProperty(k)){
        continue;
      }
      renderList(k);
    }
  });

}

function renderList(pName){
  let container_element = document.querySelector('#'+pName+'.list .content .body');
  let search_element = document.querySelector('#'+pName+' .form input[type="search"]');
  if(!listScreen[pName].data.length){
    container_element.innerHTML = '<div class="empty">'+listScreen[pName].emptyMessage+'<span>(Vérifier que le serveur Docker est accessible)</span></div>';
    return;
  }
  let filtered_list = listScreen[pName].data;
  if(search_element.value.length){
    filtered_list = filtered_list.filter((pElement)=>listScreen[pName].filter(pElement, search_element.value));
  }
  container_element.innerHTML = "";
  filtered_list.forEach((pElement, pIndex)=>{
    container_element.innerHTML += listScreen[pName].renderRow(pElement, pIndex);
  });

  container_element.querySelectorAll('.row span.checkbox, .row span.name').forEach((pElement)=>{
    pElement.addEventListener('click', (e)=>{
      let cb = e.currentTarget.parentNode.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
    });
  });

  let headers = document.querySelector('#'+pName+'.list .content .headers');
  headers.style.paddingRight = (container_element.offsetWidth - container_element.clientWidth)+"px";
}

function toggleTabHandler(e){
  saveConfig();
  const current = document.querySelector('#container>.side .current');
  const container = document.querySelector('#'+current.getAttribute("data-tab"));
  current.classList.remove("current");
  container.classList.remove("current");
  let t = e.currentTarget;
  t.classList.add("current");
  document.querySelector('#'+t.getAttribute("data-tab")).classList.add("current");
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

function rmImagesHandler(){
  let id_images = getSelectedRowsIds('#images');
  return dockerCli(["rmi", "-f"].concat(id_images)).then(updateContent);
}

function rmContainersHandler(){
  let id_containers = getSelectedRowsIds('#containers');
  return rmContainer(id_containers.join(" "));
}

function killContainersHandler(){
  let id_containers = getSelectedRowsIds('#containers');
  return killContainer(id_containers.join(" "));
}

function restartContainersHandler(){
  let id_containers = getSelectedRowsIds('#containers');
  return restartContainer(id_containers.join(" "));
}

function addLineInput(pParent, pVals){
  let input = '';
  switch(pParent.getAttribute("data-type")){
    case "value":
      input = '<input type="text" name="value" value="'+(pVals??'')+'"/>';
      break;
    case "label_value":
      input = '<input type="text" name="label" value="'+(pVals?pVals.label:'')+'"/>=<input type="text" name="value" value="'+(pVals?pVals.value:'')+'"/>';
      break;
  }
  input += '<a class="button" onclick="removeLineInputHandler(event);">-</a>';
  pParent.querySelector('.inputs').innerHTML += '<p>'+input+'</p>';
}

function endRecycle(){
  let recycleButton = document.querySelector('#workingdir .status .button.recycle');
  let cancelButton = document.querySelector('#workingdir .status .button.cancel');
  recycleButton.classList.remove("disabled");
  cancelButton.classList.add("disabled");
  running_recycle = false;
  updateContent();
}

async function saveConfig(){
  let conf = {
    docker_arguments:docker_arguments,
    docker_envs:docker_envs,
    working_dirs:working_dirs
  };
  return writeTextFile(CONFIG_FILE, JSON.stringify(conf), {dir: BaseDirectory.Public});
}

window.rmContainer = function(pId){
  return dockerCli(["rm", "-f"].concat(pId.split(" "))).then(updateContent);
}
window.rmImage = function(pId){return dockerCli(["rmi", "-f"].concat(pId.split(" "))).then(updateContent);}
window.killContainer = function (pId){
  return dockerCli(["kill", pId]).then(updateContent);
}
window.restartContainer = function (pId){
  return dockerCli(["restart"].concat(pId.split(" "))).then(updateContent);
}
window.inspectContainer = function(pId){
  if(inspections[pId]){
    renderList('containers');
    open(inspections[pId].url);
    return;
  }
  return dockerCli(["inspect", pId]).then((pData)=>{
    let data = JSON.parse(pData[0]);
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
    renderList('containers');
    open(inspections[pId].url);
  });
}
window.changeWorkingDir = function(pIndex){
  working_dir_index = pIndex;
  let dir = working_dirs[working_dir_index];
  document.querySelector('#wd_dir').value = dir.dir??'';
  if(document.querySelector('#workingdir>ul>li.current')){
    document.querySelector('#workingdir>ul>li.current').classList.remove('current');
  }
  cli('git', ['-C', dir.dir, 'branch', '--show-current']).then(([pRes])=>{
    let branch = pRes.split("/");
    let infos = {
      wd_tag:branch.pop(),
      wd_repository:dir.name+(branch.length?"/"+branch[0]:"")
    };
    infos.wd_container = infos.wd_repository.replace("/", "-")+'_'+infos.wd_tag;
    for(let i in infos){
      if(!infos.hasOwnProperty(i)){
        continue;
      }
      dir[i] = infos[i];
      document.querySelector('#'+i).value = infos[i];
    }
    document.querySelector('#workingdir>ul>li[data-id="'+pIndex+'"]').classList.add('current');
    document.querySelector('#workingdir>ul>li[data-id="'+pIndex+'"] span').innerHTML = dir.name??'';
    document.querySelector('#workingdir div[data-name="env_vars"] .inputs').innerHTML = '';
    docker_envs.forEach((pArgument)=>{
      let val = pArgument.value.replace('{value}', infos.wd_tag+'.'+(infos.wd_repository.split("/")[0]));
      addLineInput(document.querySelector('#workingdir div[data-name="env_vars"]'), {value:val, label:pArgument.label});
    });
  });
}
window.removeWorkingDir = function(pEvent){
  pEvent.preventDefault();
  pEvent.stopPropagation();
  pEvent.stopImmediatePropagation();
  let idx = Number(pEvent.currentTarget.parentNode.getAttribute("data-id"));
  document.querySelector('#workingdir>ul>li[data-id="'+idx+'"]').remove();
  let dirs = [];
  working_dirs.forEach((pElement, pIdx)=>{
    if(idx !== pIdx){
      document.querySelector('#workingdir>ul>li[data-id="'+pIdx+'"]').setAttribute("data-id", dirs.length);
      dirs.push(pElement);
    }
  });
  working_dirs = dirs;
  if(!working_dirs.length){
    newWorkingDir();
  }
  changeWorkingDir(0);
};
window.displayBox = function(pHtml){
  if(pHtml===false){
    document.querySelector('#box_overlay').classList.remove('displayed');
    return;
  }
  document.querySelector('#box_overlay').classList.add('displayed');
  document.querySelector('#box_content').innerHTML = pHtml;
}
window.renderBoxContainers = function(pId){
  let img = listScreen.images.data.find((pImg)=>pImg['IMAGE ID'] === pId);
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
window.addLineInputHandler = function(e){
  let list = e.currentTarget.parentNode.parentNode;
  addLineInput(list);
}
window.removeLineInputHandler = function(e){
  e.currentTarget.parentNode.remove();
}
window.newWorkingDir = function (){
  let tabs = document.querySelector('#workingdir>ul');
  let newTab = document.createElement('li');
  let index = working_dirs.length;
  newTab.setAttribute('data-id', index);
  newTab.innerHTML = '<span>Nouveau</span><a class="button" onclick="removeWorkingDir(event)">x</a>';
  newTab.onclick = (event)=>changeWorkingDir(event.currentTarget.getAttribute("data-id"));
  tabs.insertBefore(newTab, document.querySelector('#workingdir>ul>.button'));
  working_dirs.push({
    'name':'Nouveau',
    'dir':''
  });
  changeWorkingDir(index);
};
window.cancelRecycle = function(){
  running_recycle = false;
};
window.recycleWorkingDir = function (){
  let dir = document.querySelector('#wd_dir').value;
  let repo = document.querySelector('#wd_repository').value;
  let tag = document.querySelector('#wd_tag').value;
  let container = document.querySelector('#wd_container').value;

  let img = repo+':'+tag;

  let run_args = ['run', '-d', '--name', container];
  document.querySelectorAll('#workingdir div[data-name="env_vars"] .inputs p').forEach((pElement)=>{
    run_args.push('-e', pElement.querySelector('input[name="label"]').value+'='+pElement.querySelector('input[name="value"]').value);
  });
  run_args.push(img, '--restart=always');

  working_dir_progress.resetSteps();
  let recycleButton = document.querySelector('#workingdir .status .button.recycle');
  let cancelButton = document.querySelector('#workingdir .status .button.cancel');
  recycleButton.classList.add('disabled');
  cancelButton.classList.remove('disabled');
  working_dir_progress.setStep('kill', STATE_IN_PROGRESS);
  running_recycle = true;
  dockerCli(['kill', container]).then(([kill, pError])=>{
    working_dir_progress.setStep('kill', pError?STATE_ERROR:STATE_VALID);
    working_dir_progress.setStep('rm', STATE_IN_PROGRESS);
    if(!running_recycle){
      endRecycle();
      return;
    }
    console.log('rm container');
    dockerCli(['rm', '-f', container]).then(([rm, pError])=>{
      working_dir_progress.setStep('rm', pError?STATE_ERROR:STATE_VALID);
      working_dir_progress.setStep('rmi', STATE_IN_PROGRESS);
      if(!running_recycle){
        endRecycle();
        return;
      }
      console.log('rmi image');
      dockerCli(['rmi', '-f', img]).then(([rmi, pError])=>{
        working_dir_progress.setStep('rmi', pError?STATE_ERROR:STATE_VALID);
        working_dir_progress.setStep('build', STATE_IN_PROGRESS);
        if(!running_recycle){
          endRecycle();
          return;
        }
        console.log('build');
        dockerCli(['build', '-t', img, '-t', 'user/'+user+':'+(new Date()).getTime(), dir]).then(([build, pError])=>{
          working_dir_progress.setStep('build', pError?STATE_ERROR:STATE_VALID);
          working_dir_progress.setStep('run', STATE_IN_PROGRESS);
          if(!running_recycle){
            endRecycle();
            return;
          }
          console.log('run');
          dockerCli(run_args).then(([run, pError])=>{
            working_dir_progress.setStep('run', pError?STATE_ERROR:STATE_VALID);
            console.log("running");
            endRecycle();
          });
        });
      });
    })
  })
}

function toggleMenuHandler(){
  let side = document.querySelector('.side');
  M4Tween.killTweensOf(side);
  let open = side.classList.toggle("open");
  if(open){
    M4Tween.to(side, .4,{width:"184px"});
  }else{
    M4Tween.to(side, .3,{width:"41px"});
  }
}

function imageSearchkeyUpHandler(e){
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  if(imgSearchTo){
    clearTimeout(imgSearchTo);
  }
  imgSearchTo = setTimeout(()=>renderList('images'), 250);
}
function containerSearchkeyUpHandler(e){
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
  if(containerSearchTo){
    clearTimeout(containerSearchTo);
  }
  containerSearchTo = setTimeout(()=>renderList('containers'), 250);
}

function chooseFolderHandler(){
  openDialog({
    directory:true
  }).then((pFolder)=>{
    working_dirs[working_dir_index].dir = pFolder;
    working_dirs[working_dir_index].name = pFolder.split(sep).pop().toLowerCase();
    changeWorkingDir(working_dir_index);
  });
}

function initImagesScreen(){
  document.querySelector('#images .form #images_reload').addEventListener('click', updateContent);
  document.querySelector('#images .form #images_rm').addEventListener('click', rmImagesHandler);
  document.querySelector('#images .form input[type]').addEventListener('keyup', imageSearchkeyUpHandler);
  document.querySelector('#images .form input[type]').addEventListener('search', imageSearchkeyUpHandler);
}

function initContainersScreen(){
  document.querySelector('#containers .form #containers_reload').addEventListener('click', updateContent);
  document.querySelector('#containers .form #containers_rm').addEventListener('click', rmContainersHandler);
  document.querySelector('#containers .form #containers_restart').addEventListener('click', restartContainersHandler);
  document.querySelector('#containers .form #containers_kill').addEventListener('click', killContainersHandler);
  document.querySelector('#containers .form input[type]').addEventListener('keyup', containerSearchkeyUpHandler);
  document.querySelector('#containers .form input[type]').addEventListener('search', containerSearchkeyUpHandler);
}

function initWorkingDirsScreen(){
  working_dir_progress = new StepProgress(document.querySelector('#workingdir .status .progress'));
  working_dir_progress.addStep('kill');
  working_dir_progress.addStep('rm');
  working_dir_progress.addStep('rmi');
  working_dir_progress.addStep('build');
  working_dir_progress.addStep('run');
  document.querySelector('#home_button').addEventListener('click', toggleMenuHandler);
  document.querySelector('#workingdir #folder_choice').addEventListener('click', chooseFolderHandler);

  let tabs = document.querySelector('#workingdir>ul');
  if(!working_dirs.length){
    newWorkingDir();
  }else{
    working_dirs.forEach((pDir, pIndex)=>{
      let cls = pIndex===working_dir_index?' class="current"':'';
      tabs.innerHTML += '<li data-id="'+pIndex+'"'+cls+' onclick="((event)=>{changeWorkingDir(event.currentTarget.getAttribute(\'data-id\'));})(event);"><span>'+pDir.name+'</span><a class="button" onclick="removeWorkingDir(event)">x</a></li>';
      if(cls.length){
        changeWorkingDir(pIndex);
      }
    });
  }
  let addButton = document.createElement('li');
  addButton.classList.add('button');
  addButton.onclick = ()=>{newWorkingDir();};
  addButton.innerHTML = "+";
  tabs.appendChild(addButton);
}

function initParametersScreen(){
  docker_arguments.forEach((pArgument)=>{
    addLineInput(document.querySelector('#parameters .input>div[data-name="arguments"]'), pArgument);
  });
  docker_envs.forEach((pArgument)=>{
    addLineInput(document.querySelector('#parameters .input>div[data-name="env_vars"]'), pArgument);
  });
}

async function initConfig(){
  return new Promise(async (pResolve, pError)=>{
    cli('whoami').then(([pRes])=>{user = pRes.split('\\').pop().replace(/\s/, "");});
    let configFilesExists = await exists(CONFIG_FILE, {dir: BaseDirectory.Public});
    if(configFilesExists){
      let raw = await readTextFile(CONFIG_FILE, {dir: BaseDirectory.Public});
      const conf = JSON.parse(raw);
      docker_arguments = conf.docker_arguments||[];
      docker_envs = conf.docker_envs||[];
      working_dirs = conf.working_dirs||[];
    }else{
      await saveConfig();
    }
    pResolve();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('#container>.side *[data-tab]').forEach((pElement)=>{
    pElement.addEventListener('click', toggleTabHandler);
  });
  initConfig().then(()=>{
    console.log("inited");
    updateContent();
    initImagesScreen();
    initContainersScreen();
    initWorkingDirsScreen();
    initParametersScreen();
  });
  //document.addEventListener('contextmenu', (e)=>e.preventDefault());
});
