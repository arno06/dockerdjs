const STATE_NEUTRAL = 0;
const STATE_IN_PROGRESS = 1;
const STATE_ERROR = 2;
const STATE_VALID = 3;

class StepProgress{

    constructor(pContainer) {
        this.width = 450;
        this.stage = new Stage(this.width, 50, pContainer);
        this.stepsContainer = new Container();
        this.stage.addChild(this.stepsContainer);
        this.steps = [];
        this.stepsContainer.y = 20;
        this.styles = [
            {
                borderWidth:1,
                borderColor:'#aaa',
                indicatorColor:'#000',
                backgroundColor:'#efefef',
                labelColor:'#999'
            },
            {
                borderWidth:1,
                borderColor:'#0f84cd',
                indicatorColor:'#0f84cd',
                backgroundColor:'#fff',
                labelColor:'#0f84cd'
            },
            {
                borderWidth:1,
                borderColor:'#cd0f0f',
                indicatorColor:'#fff',
                backgroundColor:'#cd0f0f',
                labelColor:'#cd0f0f'
            },
            {
                borderWidth:1,
                borderColor:'#0f84cd',
                indicatorColor:'#fff',
                backgroundColor:'#0f84cd',
                labelColor:'#000'
            }
        ];
    }

    pause(){
        this.stage.pause();
    }

    resume(){
        this.stage.resume();
    }

    render(){
        this.stepsContainer.removeChildren();
        this.stepsContainer.clear();
        let totalSteps = this.steps.length;
        let sRadius = 14;
        let distance = (this.width - (sRadius<<1) - (totalSteps)) / (totalSteps-1);
        let lastX;
        this.steps.forEach((pElement, pIndex)=>{
            let ssprite = new Sprite();
            this.stepsContainer.addChild(ssprite);
            let style = this.styles[pElement.state];
            ssprite.clear();
            ssprite.setLineStyle(style.borderWidth, style.borderColor);
            ssprite.beginFill(style.backgroundColor);
            ssprite.drawCircle(0, 0, sRadius);
            ssprite.endFill();
            ssprite.setFont('Arial', 12, style.indicatorColor);
            let w = ssprite.measureText(pIndex+1, 'Arial', 12);
            ssprite.drawText(pIndex+1, Math.round(-(w>>1))-.5, -6.5);
            ssprite.setFont('Arial', 14, style.labelColor);
            w = ssprite.measureText(pElement.name, "Arial", 14);
            ssprite.drawText(pElement.name, -(w>>1)-0.5, sRadius + 2);
            ssprite.x = sRadius + 2 + (distance * pIndex);

            if(pIndex>0){
                this.stepsContainer.setLineStyle(2, style.borderColor);
                this.stepsContainer.moveTo(lastX + (sRadius + 5), 0);
                this.stepsContainer.lineTo(ssprite.x - (sRadius + 5), 0);
                this.stepsContainer.endFill();
            }

            lastX = ssprite.x;
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