const canvas = new fabric.Canvas('c');
let isEraserMode = false;
let currentTool = 'brush';
let actionStack = [];
let redoStack = [];
let erasingRemovesErasedObjects = false;

document
  .getElementById('imageUpload')
  .addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const imgElement = new Image();
        imgElement.src = e.target.result;
        imgElement.onload = async function () {
          const svgData = await convertToSVG(e.target.result);
          loadSVGToFabric(svgData);
        };
      };
      reader.readAsDataURL(file);
    }
  });

async function convertToSVG(imageDataUrl) {
  const response = await fetch('/convert-to-svg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  const data = await response.json();
  return data.svg;
}

function loadSVGToFabric(svgData) {
  fabric.loadSVGFromString(svgData, function (objects, options) {
    const obj = fabric.util.groupSVGElements(objects, options);
    obj.scaleToWidth(canvas.width);
    obj.set({ selectable: false, erasable: true });
    canvas.setBackgroundImage(obj, canvas.renderAll.bind(canvas));
    canvas.renderAll();
    enableDrawing(canvas);
  });
}

function enableDrawing(canvas) {
  const tools = document.querySelectorAll('.tool');
  const colorPicker = document.getElementById('colorPicker');

  tools.forEach((tool) => {
    tool.addEventListener('click', function () {
      tools.forEach((t) => t.classList.remove('selected'));
      this.classList.add('selected');
      isEraserMode = false;
      currentTool = this.id;
      applyToolSettings(canvas, currentTool);
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
        canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
        canvas.freeDrawingBrush.width = 10;
        break;
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
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
      actionStack.push({ action: 'added', object: e.target });
      redoStack = [];
    }
  });

  canvas.on('object:removed', (e) => {
    if (!isUndoing && !isRedoing) {
      actionStack.push({ action: 'removed', object: e.target });
      redoStack = [];
    }
  });

  canvas.on('erasing:end', ({ targets }) => {
    if (!isUndoing && !isRedoing) {
      actionStack.push({ action: 'erased', targets });
      redoStack = [];
    }
    targets.forEach((obj) => {
      if (erasingRemovesErasedObjects) {
        canvas.remove(obj);
      } else {
        obj.set('visible', false);
      }
    });
    canvas.renderAll();
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

function undo() {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();
    isUndoing = true;

    switch (lastAction.action) {
      case 'added':
        canvas.remove(lastAction.object);
        break;
      case 'removed':
        canvas.add(lastAction.object);
        break;
      case 'erased':
        lastAction.targets.forEach((obj) => {
          obj.set('visible', true);
          canvas.add(obj);
        });
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
        canvas.add(lastUndo.object);
        break;
      case 'removed':
        canvas.remove(lastUndo.object);
        break;
      case 'erased':
        lastUndo.targets.forEach((obj) => {
          obj.set('visible', false);
          if (erasingRemovesErasedObjects) {
            canvas.remove(obj);
          }
        });
        break;
    }

    actionStack.push(lastUndo);
    canvas.renderAll();
    isRedoing = false;
  }
}

function setDrawableErasableProp(drawable, value) {
  canvas.get(drawable)?.set({ erasable: value });
  changeAction('erase');
}

function setBgImageErasableProp(input) {
  const bgImage = canvas.backgroundImage;
  if (bgImage) {
    bgImage.set({ erasable: input.checked });
    canvas.renderAll();
  }
}

function setErasingRemovesErasedObjects(input) {
  erasingRemovesErasedObjects = input.checked;
}

function downloadImage() {
  const ext = 'png';
  const base64 = canvas.toDataURL({
    format: ext,
    enableRetinaScaling: true,
  });
  const link = document.createElement('a');
  link.href = base64;
  link.download = `eraser_example.${ext}`;
  link.click();
}

function downloadSVG() {
  const svg = canvas.toSVG();
  const a = document.createElement('a');
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const blobURL = URL.createObjectURL(blob);
  a.href = blobURL;
  a.download = 'eraser_example.svg';
  a.click();
  URL.revokeObjectURL(blobURL);
}

async function toJSON() {
  const json = canvas.toDatalessJSON(['clipPath', 'eraser']);
  const out = JSON.stringify(json, null, '\t');
  const blob = new Blob([out], { type: 'text/plain' });
  const clipboardItemData = { [blob.type]: blob };
  try {
    navigator.clipboard &&
      (await navigator.clipboard.write([new ClipboardItem(clipboardItemData)]));
  } catch (error) {
    console.log(error);
  }
  const blobURL = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobURL;
  a.download = 'eraser_example.json';
  a.click();
  URL.revokeObjectURL(blobURL);
}

init();
