const canvas = new fabric.Canvas('c');
let actionHistory = [];
let isEraserMode = false;
let currentTool = 'brush';

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
    obj.set({ selectable: false, evented: false });
    canvas.add(obj);
    canvas.sendToBack(obj);
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
        undoErasing();
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

  function undoErasing() {
    const lastAction = actionHistory.pop();
    if (lastAction) {
      lastAction.forEach((obj) => {
        obj.set('visible', true);
        canvas.add(obj);
      });
      canvas.renderAll();
    }
  }

  canvas.on('erasing:end', ({ targets }) => {
    actionHistory.push(targets);
    targets.forEach((obj) => {
      obj.set('visible', false);
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
