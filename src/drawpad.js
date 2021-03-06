
var CANVAS_WIDTH = 800;
var CANVAS_HEIGHT = 800;
var FADE_START = 5000;
var FADE_END = 10000;

var MESSAGES = [];
function showMessage(msg) {
    MESSAGES.splice(0,0,msg);
    if (MESSAGES.length > 25)
        MESSAGES = MESSAGES.slice(0,25);
    document.getElementById('foo').innerHTML = MESSAGES.join("<br/>");
}

function initializeDrawpad() {
    window.NEXT_PLAYER = 0;
    window.PLAYERS = {};
    window.SERVER_PLAYER = addPlayer();

    var canvas = document.getElementById('cvs');
    window.CANVAS = canvas;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    canvas.addEventListener('touchstart', touchstart);
    canvas.addEventListener('touchend', touchend);
    canvas.addEventListener('touchmove', touchmove);
    canvas.addEventListener('touchcancel', touchcancel);

    function normalizeEvent(evt) {
        if (evt.touches.length == 0)
            return;
        var touch = evt.touches[0];
        return {'type':evt.type, 'x':touch.pageX, 'y':touch.pageY};
    }

    var cur_stroke = null;
    function touchstart(evt) {
        evt = normalizeEvent(evt);
        if (!evt)
            return;
        cur_stroke = window.SERVER_PLAYER.addStroke();
        cur_stroke.addPoint(evt);
    }
    function touchend(evt) {
        cur_stroke.end_time = Date.now();
        cur_stroke = null;
    }
    function touchmove(evt) {
        if (!cur_stroke)
            return;
        evt = normalizeEvent(evt);
        if (!evt)
            return;
        cur_stroke.addPoint(evt);
        drawStrokesOnce();
    }
    function touchcancel(evt) {
        cur_stroke.end_time = Date.now();
        cur_stroke = null;
    }

    drawStrokes();
}

function drawStrokes() {
    drawStrokesOnce();
    setTimeout(drawStrokes, 1);
}
function drawStrokesOnce() {
    try {
        var canvas = window.CANVAS;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        for (var player_id in window.PLAYERS) {
            window.PLAYERS[player_id].draw(ctx);
        }
    } catch(err) {
        showMessage(err.toString());
    }
}

function generateColor(player_id) {
    var colors = [[255,0,0], [0,255,0], [0,0,255],
                  [255,255,0], [255,0,255], [0,255,255]];
    return colors[player_id % colors.length];
}

function addPlayer(id) {
    var player_id = window.NEXT_PLAYER++;
    var player_info = new Player(player_id);
    window.PLAYERS[player_id] = player_info;
    return player_info;
}

function Player(id) {
    this.id = id;
    this.color = this.id == 0 ? [0,0,0] : generateColor(id);
    this.strokes = [];
}
Player.prototype.addStroke = function () {
    var stroke = new Stroke();
    this.strokes.push(stroke);
    return stroke;
};
Player.prototype.draw = function (ctx) {
    for (var i = 0; i < this.strokes.length; i++) {
        this.strokes[i].draw(ctx, this);
    }
    var old_len = this.strokes.length;
    this.strokes = this.strokes.filter(function (stroke) {
        if (!stroke.end_time)
            return true;
        return (Date.now() - stroke.end_time) < FADE_END;
    });
    var new_len = this.strokes.length;
    if (new_len < old_len) {
        console.log("Removed " + (old_len - new_len) + " strokes");
    }
};

function Stroke() {
    this.points = [];
}
Stroke.prototype.addPoint = function(evt) {
    this.points.push({ time: Date.now(), x: evt.x, y: evt.y });
};
Stroke.prototype.draw = function (ctx, player) {
    if (this.points.length < 1)
        return;

    var now = Date.now();
    var cur_point = this.points[0];

    if (this.points.length == 1) {
        var alpha = getAlpha(now, cur_point.time);
        var color = 'rgba(' + player.color.join(',') + ',' + alpha + ')';
        ctx.fillStyle = color;
        ctx.fillRect(cur_point.x - 2, cur_point.y - 2, 4, 4);
        return;
    }

    for (var i = 1; i < this.points.length; i++) {
        var next_point = this.points[i];
        var alpha = getAlpha(now, cur_point.time);
        var color = 'rgba(' + player.color.join(',') + ',' + alpha + ')';
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cur_point.x, cur_point.y);
        ctx.lineTo(next_point.x, next_point.y);
        ctx.stroke();
        cur_point = next_point;
    }
};

function getAlpha(now, time) {
    var time_diff = now - time;
    var alpha;
    if (time_diff < FADE_START)
        return 1;
    if (time_diff < FADE_END) {
        var range = FADE_END - FADE_START;
        return (range - (time_diff - FADE_START)) / range;
    }
    return 0;
}
