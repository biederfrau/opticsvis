function compute(data, state) {

}

function filter(state) {

}

function setup_density(state) {

}

function draw_density(data, state) {

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

    $(".ui-bar *").click(function(e) {
        if(!$(".ui-bar").hasClass("toggled")) { $(".ui-bar").addClass("toggled"); }

        if($(this).hasClass("toggled")) {
            var siblings = $(this).siblings(),
                none_toggled = true;

            siblings.each(idx => {
                none_toggled = none_toggled && !$(siblings[idx]).hasClass("toggled");
            });

            if(none_toggled) { $(".ui-bar").removeClass("toggled"); }
        }

        $(this).toggleClass("toggled");
    });

    $("#about-input").click(e => {
        $(".ui-bar .about-entry").toggleClass("toggled");
    });

    $("#data-input").click(e => {
        $(".ui-bar .data-entry").toggleClass("toggled");
    });

    $("#data-form").submit(e => {
        state.data = $("#data-textarea").val().split("\n")
            .map(_.trim).filter(line => line !== "")
            .map(x => x.split(" ")).map(x => x.map(parseFloat));

        console.log("new data: ", state.data);
    });

    // state.thinking(5);
    var ssv = d3.dsvFormat(" ");
    d3.request("default.dat")
        .mimeType("text/plain")
        .response(xhr => ssv.parse(xhr.responseText, row => [row.x, row.y]))
        .get((err, data) => {
            if(err) { throw err; }

            console.log(data);
            compute(data, state);

            setup_density(state);
            setup_reach(state);
            setup_clusters(state);
            setup_jumps(state);
            setup_heat(state);
    });
}//}}}
// vim: set ts=4 sw=4 tw=0 et :
