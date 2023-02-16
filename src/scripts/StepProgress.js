const STATE_NEUTRAL = 'neutral';
const STATE_IN_PROGRESS = 'in_progress';
const STATE_ERROR = 'error';
const STATE_VALID = 'valid';

class StepProgress{

    constructor(pContainer) {
        this.steps = [];
        this.container = document.createElement('div');
        this.container.classList.add('step_progress');
        pContainer.appendChild(this.container);
    }

    render(){
        this.container.innerHTML = '';

        this.steps.forEach((pElement, pIndex)=>{
            let s = document.createElement('div');
            s.classList.add(pElement.state);
            s.classList.add('step');
            let indicator = document.createElement('span');
            indicator.classList.add('indicator');
            indicator.innerHTML = (pIndex + 1).toString();
            s.appendChild(indicator);
            let label = document.createElement('span');
            label.classList.add('label');
            label.innerHTML = pElement.name;
            s.appendChild(label);
            this.container.appendChild(s);

            if(pIndex<this.steps.length-1){
                let line = document.createElement('div');
                line.classList.add('line');
                line.classList.add(this.steps[pIndex+1].state);
                this.container.appendChild(line);
            }
        });
    }

    addStep(pId, pName = null){
        this.steps.push({
            id:pId,
            name:pName??pId,
            state:STATE_NEUTRAL
        });
        this.render();
        return this;
    }

    setStep(pId, pState){
        let step = this.steps.find((pStep)=>pStep.id===pId);
        if(!step){
            return;
        }
        step.state = pState;
        this.render();
    }

    resetSteps(pState = STATE_NEUTRAL){
        this.steps.forEach((pElement)=>{
            pElement.state = pState;
        });
        this.render();
    }
}

export {StepProgress, STATE_NEUTRAL, STATE_ERROR, STATE_VALID, STATE_IN_PROGRESS};