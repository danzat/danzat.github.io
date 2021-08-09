function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
        let t = b;
        b = a % b;
        a = t;
    }
    return a;
}

class Constraint {
    constructor(ax, ay, bx, by) {
        this.A = [ax, ay];
        this.B = [bx, by];

        let dx = bx - ax;
        let dy = by - ay;

        this.nx = dy;
        this.ny = -dx;

        this.b = this.nx * ax + this.ny * ay;

        this.active = false;
    }

    toggle() {
        this.active = !this.active;
    }

    get color() {
        if (this.active) {
            return "black";
        } else {
            return "gray";
        }
    }
}

class HalfSpace extends Constraint {
    test(x, y) {
        return (this.nx * x + this.ny * y) <= this.b;
    }

    draw(ctx) {
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(this.A[0], this.A[1]);
        ctx.lineTo(this.B[0], this.B[1]);
        ctx.stroke();

        ctx.strokeStyle = "blue";
        ctx.beginPath();
        let mx = (this.A[0] + this.B[0]) / 2;
        let my = (this.A[1] + this.B[1]) / 2;

        let n = Math.sqrt(this.nx * this.nx + this.ny * this.ny);
        let nhx = this.nx / n;
        let nhy = this.ny / n;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + nhx * 10, my + nhy * 10);
        ctx.stroke();
    }

    show() {
        let D = gcd(this.nx, this.ny, this.b);
        let A = this.nx / D;
        let B = this.ny / D;
        let C = this.b / D;
        if (B < 0) {
            return `$$${A} x - ${-B} y \\le ${C}$$`;
        } else {
            return `$$${A} x + ${B} y \\le ${C}$$`;
        }
    }
}

class HyperPlane extends Constraint {
    test(x, y) {
        let dx = x - this.A[0];
        let dy = y - this.A[1];
        let dot = dx * this.nx + dy * this.ny;
        let n = this.nx * this.nx + this.ny * this.ny;
        let dist2 = dot * dot / n;
        return dist2 < 5;
    }

    draw(ctx) {
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(this.A[0], this.A[1]);
        ctx.lineTo(this.B[0], this.B[1]);
        ctx.stroke();
    }

    show() {
        let D = gcd(this.nx, this.ny, this.b);
        let A = this.nx / D;
        let B = this.ny / D;
        let C = this.b / D;
        if (B < 0) {
            return `$$${A} x - ${-B} y = ${C}$$`;
        } else {
            return `$$${A} x + ${B} y = ${C}$$`;
        }
    }
}

class Demo {
    constructor() {
        this.constraints = [
            new HalfSpace(120, 0, 180, 200),
            new HalfSpace(0, 60, 200, 20),
            new HalfSpace(200, 120, 0, 170),
            new HalfSpace(10, 200, 20, 0),
            new HyperPlane(50, 0, 200, 140),
            new HyperPlane(0, 150, 120, 0),
        ];
    }

    setup() {
        let root = $("#constraints");
        let self = this;
        for (let constraint of this.constraints) {
            $("<div/>")
                .text(constraint.show())
                .css("color", constraint.color)
                .click(function(event) {
                    self.handleClick(this, constraint);
                })
                .appendTo(root);
        }
        MathJax.Hub.Typeset();
        this.render();
    }

    handleClick(element, constraint) {
        constraint.toggle();
        $(element).css("color", constraint.color);
        this.render();
    }

    render() {
        let canvas = document.getElementById("canvas");
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, 200, 200);
        ctx.fillStyle = "red";
        for (let x = 0; x < 200; x += 1) {
            for (let y = 0; y < 200; y += 1) {
                if (this.verify(x, y)) {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        for (let constraint of this.constraints) {
            if (!constraint.active) {
                continue;
            }
            constraint.draw(ctx);
        }
    }

    verify(x, y) {
        for (let constraint of this.constraints) {
            if (!constraint.active) {
                continue;
            }
            if (!constraint.test(x, y)) {
                return false;
            }
        }
        return true;
    }
}

let demo = new Demo();
