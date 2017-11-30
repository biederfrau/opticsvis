function compute(data, state) {
    state.input_data = $.extend(true, [], data);
    state.output_data = optics(data);
}

function filter(state) {

}

// https://bl.ocks.org/mbostock/7f5f22524bd1d824dd53c535eda0187f
function setup_density(state) {
    var canvas = d3.select("#density"),
        style = window.getComputedStyle(document.getElementById("density")),
        margins = {"left": 55, "right": 35, "top": 50, "bottom": 35},
        width = parseFloat(style.width),
        height = parseFloat(style.height);

    canvas.append("text").attr("x", width / 2 + margins.left).attr("y", margins.top / 2)
        .text("Density of data set").style("font-weight", "bold").attr("text-anchor", "middle");

    var x = d3.scaleLinear().range([margins.left, width - margins.right]),
        y = d3.scaleLinear().range([height - margins.bottom, margins.top]);

    canvas.append("g").classed("xaxis", true).attr("transform", "translate(" + [0, height - margins.bottom] + ")");
    canvas.append("g").classed("yaxis", true).attr("transform", "translate(" + [margins.left, 0] + ")");

    var ctx = {"x": x, "y": y, "margins": margins, "width": width, "height": height};
    draw_density(state.input_data, state, ctx);
}

function draw_density(data, state, ctx) {
    var canvas = d3.select("#density"),
        color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, .004]);

    ctx.x.domain(d3.extent(data, x => x[0]));
    ctx.y.domain(d3.extent(data, x => x[1]));

    canvas.select(".xaxis").call(d3.axisBottom(ctx.x));
    canvas.select(".yaxis").call(d3.axisLeft(ctx.y));

    var densityEstimator = d3.contourDensity()
        .x(d => ctx.x(d[0]))
        .y(d => ctx.y(d[1]))
        .size([ctx.width, ctx.height]);

    canvas.insert("g", "g")
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round")
        .selectAll("path")
        .data(densityEstimator(data))
        .enter().append("path").attr("fill", d => color(d.value))
        .attr("d", d3.geoPath());

    state.dispatcher.call("drawn");
}

function setup_reach(data, state) {

}

function draw_reach(data, state) {

    state.dispatcher.call("drawn");
}

function setup_clusters(state) {

}

function draw_clusters(data, state) {

    state.dispatcher.call("drawn");
}

function setup_jumps(state) {

}

function draw_jumps(data, state) {

    state.dispatcher.call("drawn");
}

function setup_heat(state) {

}

function draw_heat(data, state) {

    state.dispatcher.call("drawn");
}

function do_the_things() {//{{{
    state = {
        dispatcher: d3.dispatch("drawn", "filter", "date:update", "cat:update", "dist:update", "update"),
        start: performance.now(),
        thinking: function(n = 4) {
            d3.selectAll(".loading").style("display", undefined);

            waiter = n;
            this.dispatcher.on("drawn", _e => {
                waiter -= 1;

                if(waiter == 0) {
                    d3.selectAll(".loading").style("display", "none");
                    console.log("finished waiting at " + _.round(performance.now() - state.start, 2) + "ms");
                }
            });
        },
    };

    // ui crap {{{
    $(".ui-bar .elem").click(function(e) {
        if(!$(".ui-bar").hasClass("toggled")) { $(".ui-bar").addClass("toggled"); }

        if($(this).hasClass("toggled")) {
            var siblings = $(this).siblings(),
                none_toggled = true;

            siblings.each(idx => {
                none_toggled = none_toggled && !$(siblings[idx]).hasClass("toggled");
            });

            console.log(siblings);
            console.log(none_toggled);
            if(none_toggled) { $(".ui-bar").removeClass("toggled"); }
        }

        $(this).toggleClass("toggled");
    });

    $("#about-input").click(e => {
        $(".ui-bar .about-entry").toggleClass("visible");
    });

    $("#data-input").click(e => {
        $(".ui-bar .data-entry").toggleClass("visible");
    });

    $("#data-form").submit(e => {
        state.data = $("#data-textarea").val().split("\n")
            .map(_.trim).filter(line => line !== "")
            .map(x => x.split(" ")).map(x => x.map(parseFloat));

        compute(data, state);
        state.dispatcher.call("update", [state.input_data, state.output_data]);
    }); // }}}

    // state.thinking(5);
    var ssv = d3.dsvFormat(" ");
    d3.request("default.dat")
        .mimeType("text/plain")
        .response(xhr => ssv.parse(xhr.responseText, row => [+row.x, +row.y]))
        .get((err, data) => {
            if(err) { throw err; }

            compute(data, state);

            setup_density(state);
            setup_reach(state);
            setup_clusters(state);
            setup_jumps(state);
            setup_heat(state);
    });
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
