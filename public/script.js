const canvas = new fabric.Canvas('c');
let isEraserMode = false;
let currentTool = 'brush';
let actionStack = [];
let redoStack = [];
let uploadedImage;

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  const canvasElement = document.getElementById('c');
  canvasElement.width = container.clientWidth;
  canvasElement.height = container.clientHeight;
  canvas.setWidth(container.clientWidth);
  canvas.setHeight(container.clientHeight);
  canvas.renderAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document
  .getElementById('imageUpload')
  .addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const imgElement = new Image();
        imgElement.src = e.target.result;
        imgElement.onload = function () {
          const imgInstance = new fabric.Image(imgElement, {
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
            erasable: true,
          });
          canvas.add(imgInstance);
          canvas.sendToBack(imgInstance);
          uploadedImage = imgInstance;
        };
      };
      reader.readAsDataURL(file);
    }
  });

function enableDrawing(canvas) {
  const tools = document.querySelectorAll('.tool');
  const colorPicker = document.getElementById('colorPicker');
  const toolbar = document.getElementById('toolbar');
  const allToolsContainer = document.getElementById('all-tools');

  tools.forEach((tool) => {
    tool.addEventListener('click', function () {
      if (this.id === 'undo') {
        undo();
        return;
      }
      if (this.id === 'redo') {
        redo();
        return;
      }

      tools.forEach((t) => t.classList.remove('selected'));
      this.classList.add('selected');
      isEraserMode = false;
      currentTool = this.id;
      applyToolSettings(canvas, currentTool);

      const mainToolButton = toolbar.querySelector('.tool');
      if (mainToolButton.id !== this.id) {
        const mainToolId = mainToolButton.id;
        mainToolButton.id = this.id;
        mainToolButton.textContent = this.textContent;

        const clickedToolClone = this.cloneNode(true);
        clickedToolClone.addEventListener('click', tool.click);
        allToolsContainer.replaceChild(clickedToolClone, this);

        const mainToolClone = document.createElement('button');
        mainToolClone.id = mainToolId;
        mainToolClone.textContent =
          mainToolId.charAt(0).toUpperCase() + mainToolId.slice(1);
        mainToolClone.classList.add('tool');
        mainToolClone.addEventListener('click', tool.click);
        allToolsContainer.replaceChild(mainToolClone, mainToolButton);
      }
    });
  });

  colorPicker.addEventListener('change', function (event) {
    if (!isEraserMode) {
      canvas.freeDrawingBrush.color = event.target.value;
    }
  });

  function applyToolSettings(canvas, tool) {
    switch (tool) {
      case 'brush':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = colorPicker.value;
        break;
      case 'erase':
        canvas.isDrawingMode = true;
        isEraserMode = true;
        const eraserBrush = new fabric.EraserBrush(canvas);
        eraserBrush.width = 10;
        canvas.freeDrawingBrush = eraserBrush;
        break;
      case 'select':
        canvas.isDrawingMode = false;
        break;
      case 'spray':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.SprayBrush(canvas);
        canvas.freeDrawingBrush.width = 35;
        canvas.freeDrawingBrush.color = colorPicker.value;
        break;
      default:
        break;
    }
  }

  canvas.on('object:added', (e) => {
    if (!isUndoing && !isRedoing) {
      actionStack.push({
        action: 'added',
        object: e.target.toJSON(['clipPath', 'eraser']),
      });
      redoStack = [];
    }
  });

  canvas.on('object:removed', (e) => {
    if (!isUndoing && !isRedoing) {
      actionStack.push({
        action: 'removed',
        object: e.target.toJSON(['clipPath', 'eraser']),
      });
      redoStack = [];
    }
  });

  canvas.on('erasing:end', ({ targets }) => {
    if (!isUndoing && !isRedoing) {
      actionStack.push({
        action: 'erased',
        targets: targets.map((target) => target.toJSON(['clipPath', 'eraser'])),
      });
      redoStack = [];
    }
    targets.forEach((obj) => {
      obj.set('dirty', true);
      canvas.requestRenderAll();
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (canvas.getActiveObject()) {
        canvas.remove(canvas.getActiveObject());
        canvas.renderAll();
      }
    }
  });

  document.getElementById('brush').click();
}

let isUndoing = false;
let isRedoing = false;

function getObjectById(id) {
  return canvas.getObjects().find((obj) => obj.id === id);
}

function undo() {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
    isUndoing = true;

    switch (lastAction.action) {
      case 'added':
        const addedObject = getObjectById(lastAction.object.id);
        if (addedObject) {
          canvas.remove(addedObject);
        }
        break;
      case 'removed':
        fabric.util.enlivenObjects(
          [lastAction.object],
          function (enlivenedObjects) {
            canvas.add(enlivenedObjects[0]);
          }
        );
        break;
      case 'erased':
        fabric.util.enlivenObjects(
          lastAction.targets,
          function (enlivenedObjects) {
            enlivenedObjects.forEach((obj) => {
              obj.visible = true;
              canvas.add(obj);
              obj.set('dirty', true);
            });
            canvas.requestRenderAll();
          }
        );
        break;
    }

    redoStack.push(lastAction);
    canvas.renderAll();
    isUndoing = false;
  }
}

function redo() {
  if (redoStack.length > 0) {
    const lastUndo = redoStack.pop();
    isRedoing = true;

    switch (lastUndo.action) {
      case 'added':
        fabric.util.enlivenObjects(
          [lastUndo.object],
          function (enlivenedObjects) {
            canvas.add(enlivenedObjects[0]);
          }
        );
        break;
      case 'removed':
        const removedObject = getObjectById(lastUndo.object.id);
        if (removedObject) {
          canvas.remove(removedObject);
        }
        break;
      case 'erased':
        fabric.util.enlivenObjects(
          lastUndo.targets,
          function (enlivenedObjects) {
            enlivenedObjects.forEach((obj) => {
              obj.visible = false;
            });
            canvas.requestRenderAll();
          }
        );
        break;
    }

    actionStack.push(lastUndo);
    canvas.renderAll();
    isRedoing = false;
  }
}

function setDrawableErasableProp(drawable, value) {
  const object = getObjectById(drawable);
  if (object) {
    object.set({ erasable: value });
    canvas.renderAll();
  }
}

function toggleErasableImage() {
  if (uploadedImage) {
    const isErasable = uploadedImage.get('erasable');
    uploadedImage.set({ erasable: !isErasable });
    canvas.renderAll();
  }
}

enableDrawing(canvas);
