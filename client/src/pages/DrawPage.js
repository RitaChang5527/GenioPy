import React, { useLayoutEffect, useState, useRef, useEffect } from "react";
import rough from "roughjs/bundled/rough.esm";
import getStroke from "perfect-freehand";

const generator = rough.generator();

const createCustomElement = (id, x1, y1, x2, y2, type, options, filled) => {
  console.log("Filled status:", filled);

  switch (type) {
    case "line":
    case "rectangle":
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2, { stroke: options.color })
          : generator.rectangle(x1, y1, x2 - x1, y2 - y1, {
              stroke: options.color,
              fill: options.filled ? options.color : "transparent",
            });
      return { id, x1, y1, x2, y2, type, options, roughElement };
    case "brush":
      return { id, type, points: [{ x: x1, y: y1 }], options };
    case "text":
      return { id, type, x1, y1, x2, y2, text: "" };
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
};

const positionWithElement = (x, y, element) => {
  const { type, x1, x2, y1, y2 } = element;
  switch (type) {
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || topRight || bottomLeft || bottomRight || inside;
    case "brush":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return (
          onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null
        );
      });
      return betweenAnyPoint ? "inside" : null;
    case "text":
      return x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
    default:
      throw new Error(`Type not recognised: ${type}`);
  }
};
const distance = (a, b) =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const getElementAtPosition = (x, y, elements) => {
  return elements
    .map((element) => ({
      ...element,
      position: positionWithElement(x, y, element),
    }))
    .find((element) => element.position !== null);
};

const adjustElementCoordinates = (element) => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};
const cursorForPosition = (position) => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
};

const resizedCoordinates = (offsetX, offsetY, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: offsetX, y1: offsetY, x2, y2 };
    case "tr":
      return { x1, y1: offsetY, x2: offsetX, y2 };
    case "bl":
      return { x1: offsetX, y1, x2, y2: offsetY };
    case "br":
    case "end":
      return { x1, y1, x2: offsetX, y2: offsetY };
    default:
      return null;
  }
};

const useHistory = (initialState) => {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([initialState]);

  const setState = (action, overwrite = false) => {
    const newState =
      typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updateState = [...history.slice(0, index + 1)];
      setHistory((prevState) => [...updateState, newState]);
      setIndex((prevState) => prevState + 1);
    }
  };
  const undo = () => index > 0 && setIndex((prevState) => prevState - 1);
  const redo = () =>
    index < history.length - 1 && setIndex((prevState) => prevState + 1);

  return [history[index], setState, undo, redo];
};

const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
};

const adjustmentRequired = (type) => ["line", "rectangle"].includes(type);

const drawElement = (roughCanvas, context, element, filled) => {
  switch (element.type) {
    case "line":
    case "rectangle":
      context.fillStyle = filled ? element.options.color : "transparent";
      roughCanvas.draw(element.roughElement);
      break;
    case "brush":
      context.fillStyle = element.options.color;
      const stroke = getSvgPathFromStroke(getStroke(element.points));
      context.fill(new Path2D(stroke));
      break;
    case "text":
      context.textBaseline = "top";
      context.font = "24px sans-serif";
      context.fillText(element.text, element.x1, element.y1);
      break;
    default:
      throw new Error(`Type not recognised: ${element.type}`);
  }
};

const Drawing = () => {
  const [elements, setElements, undo, redo] = useHistory([]);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("rectangle");
  const [selectedElement, setSelectedElement] = useState(null);
  const [color, setColor] = React.useState("black");
  const [filled, setFilled] = useState(false);
  const textAreaRef = useRef();

  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);

    elements.forEach((element) => {
      if (action === "writing" && selectedElement.id === element.id) return;
      drawElement(roughCanvas, context, element);
    });
  }, [elements]);

  useEffect(() => {
    const undoRedoFunction = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (action === "writing") {
      setTimeout(() => {
        textArea.focus();
        textArea.value = selectedElement.text;
      }, 0);
    }
  }, [action, selectedElement]);

  const handleFilledChange = () => {
    setFilled(!filled);
  };

  const updateElement = (id, x1, y1, x2, y2, type, options) => {
    const elementsCopy = [...elements];

    switch (type) {
      case "line":
      case "rectangle":
        elementsCopy[id] = createCustomElement(
          id,
          x1,
          y1,
          x2,
          y2,
          type,
          options
        );
        break;
      case "brush":
        elementsCopy[id].points = [
          ...elementsCopy[id].points,
          { x: x2, y: y2 },
        ];
        break;
      case "text":
        const textWidth = document
          .getElementById("canvas")
          .getContext("2d")
          .measureText(options.text).width;
        const textHeight = 24;
        elementsCopy[id] = {
          ...createCustomElement(
            id,
            x1,
            y1,
            x1 + textWidth,
            y1 + textHeight,
            type,
            options
          ),
          text: options.text,
        };
        break;
      default:
        throw new Error(`Type not recognised: ${type}`);
    }

    setElements(elementsCopy, true);
  };

  const handleMouseDown = (event) => {
    if (action === "writing") return;
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    if (tool === "selection") {
      const element = getElementAtPosition(offsetX, offsetY, elements);
      if (element) {
        if (element.type === "brush") {
          const xOffsets = element.points.map((point) => offsetX - point.x);
          const yOffsets = element.points.map((point) => offsetY - point.y);
          setSelectedElement({ ...element, xOffsets, yOffsets });
        } else {
          const fitsetX = offsetX - element.x1;
          const fitsetY = offsetY - element.y1;
          setSelectedElement({ ...element, fitsetX, fitsetY });
        }

        setElements((prevState) => prevState);
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resizing");
        }
      }
    } else {
      const id = elements.length;
      const element = createCustomElement(
        id,
        offsetX,
        offsetY,
        offsetX,
        offsetY,
        tool,
        { color, filled }
      );
      setElements((prevState) => [...prevState, element]);
      setSelectedElement(element);
      setAction(tool === "text" ? "writing" : "drawing");
    }
  };

  const handleMouseMove = (event) => {
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    if (tool === "selection") {
      const element = getElementAtPosition(offsetX, offsetY, elements);
      event.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }
    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1, options } = elements[index];
      updateElement(index, x1, y1, offsetX, offsetY, tool, options);
    } else if (action === "moving") {
      if (selectedElement.type === "brush") {
        const newPoints = selectedElement.points.map((_, index) => ({
          x: offsetX - selectedElement.xOffsets[index],
          y: offsetY - selectedElement.yOffsets[index],
        }));
        const elementsCopy = [...elements];
        elementsCopy[selectedElement.id] = {
          ...elementsCopy[selectedElement.id],
          points: newPoints,
        };
        setElements(elementsCopy, true);
      } else {
        const {
          id,
          x1,
          x2,
          y1,
          y2,
          options: colorOptions,
          type,
          fitsetX,
          fitsetY,
        } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const newX1 = offsetX - fitsetX;
        const newY1 = offsetY - fitsetY;
        const options = type === "text" ? { text: selectedElement.text } : {};
        updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type, {
          ...options,
          ...colorOptions,
        });
      }
    } else if (action === "resizing") {
      const { id, type, options, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        offsetX,
        offsetY,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type, options);
    }
  };

  const handleMouseUp = (event) => {
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    if (selectedElement) {
      if (
        selectedElement.type === "text" &&
        offsetX - selectedElement.fitsetX === selectedElement.x1 &&
        offsetY - selectedElement.fitsetY === selectedElement.y1
      ) {
        setAction("writing");
        return;
      }

      const index = selectedElement.id;
      const { id, type, options } = elements[index];
      if (
        (action === "drawing" || action === "resizing") &&
        adjustmentRequired(type)
      ) {
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type, options);
      }
    }

    if (action === "writing") return;

    setAction("none");
    setSelectedElement(null);
  };

  const handleBlur = (event) => {
    const { id, x1, y1, type } = selectedElement;
    setAction("none");
    setSelectedElement(null);
    updateElement(id, x1, y1, null, null, type, { text: event.target.value });
  };

  const saveToLocal = () => {
    try {
      const canvas = document.getElementById("canvas");
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = "drawing.png";
      link.click();
    } catch (error) {
      console.error("Error saving drawing locally:", error);
    }
  };

  return (
    <div className="container">
      <section className="tools-board">
        <div className="row">
          <label className="title">Shapes</label>
          <div className="horizontal">
            <input
              className="option"
              type="radio"
              id="selection"
              checked={tool === "selection"}
              onChange={() => setTool("selection")}
            />
            <label htmlFor="selection">Selection</label>
          </div>
          <div className="horizontal">
            <input
              className="option"
              type="radio"
              id="rectangle"
              checked={tool === "rectangle"}
              onChange={() => setTool("rectangle")}
            />
            <label htmlFor="rectangle">Rectangle</label>
          </div>
          <div className="horizontal">
            <label>Filled</label>
            <input
              className="option"
              type="checkbox"
              checked={filled}
              onChange={handleFilledChange}
            />
          </div>

          <div className="horizontal">
            <input
              className="option"
              type="radio"
              id="line"
              checked={tool === "line"}
              onChange={() => setTool("line")}
            />
            <label htmlFor="line">line</label>
          </div>
        </div>
        <div className="row">
          <label className="title">Options</label>
          <div className="horizontal">
            <input
              className="option"
              type="radio"
              id="brush"
              checked={tool === "brush"}
              onChange={() => setTool("brush")}
            />
            <label htmlFor="brush">Brush</label>
          </div>
          <div className="horizontal">
            <input
              className="option"
              type="radio"
              id="text"
              checked={tool === "text"}
              onChange={() => setTool("text")}
            />
            <label htmlFor="text">Text</label>
          </div>
          {action === "writing" ? (
            <textarea
              ref={textAreaRef}
              onBlur={handleBlur}
              style={{
                position: "fixed",
                top: selectedElement.y1,
                left: selectedElement.x1,
                font: "24px sans-serif",
                margin: 0,
                padding: 0,
                border: 0,
                outline: 0,
                resize: "auto",
                overflow: "hidden",
                whiteSpace: "pre",
                background: "transparent",
                zIndex: 2,
              }}
            />
          ) : null}
          <div className="horizontal">
            <input
              className="option"
              type="radio"
              // id="eraser"
              // checked={tool === "eraser"}
              // onChange={() => setTool("eraser")}
            />
            <label htmlFor="eraser">Eraser</label>
          </div>
        </div>
        <div className="row">
          <label className="title">Colors</label>
          <div className="color-options">
            <input
              className="option-red"
              type="radio"
              checked={color === "red"}
              onChange={() => setColor("red")}
            />
            <input
              className="option-orange"
              type="radio"
              checked={color === "orange"}
              onChange={() => setColor("orange")}
            />
            <input
              className="option-green"
              type="radio"
              checked={color === "green"}
              onChange={() => setColor("green")}
            />
            <input
              className="option-black"
              type="radio"
              checked={color === "black"}
              onChange={() => setColor("black")}
            />
          </div>
        </div>
        <div className="row buttons">
          <button className="clear-canvas" onClick={undo}>
            undo
          </button>
          <button className="clear-canvas" onClick={redo}>
            redo
          </button>
          <button className="save-img" onClick={saveToLocal}>
            Save As Image
          </button>
        </div>
      </section>
      <section className="drawing-board">
        <canvas
          id="canvas"
          width={690}
          height={550}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </section>
    </div>
  );
};

export default Drawing;
