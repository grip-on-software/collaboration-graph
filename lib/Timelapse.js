/**
 * Timelapse handler
 */
import * as d3 from 'd3';
import moment from 'moment';
import Mousetrap from 'mousetrap';

const intervalFile = id => `data/project_members/project_members-interval-${id}.json`;

const highestSpeed = 500; // Max speed is ticking each 0.5 seconds
const lowestSpeed = 4000; // Lowest speed is 4 seconds

/**
 * An interval-based timelapse for a network.
 */
export default class Timelapse {
    constructor(network, intervals, locales, options) {
        this.network = network;
        this.intervals = intervals;
        this.locales = locales;
        this.options = options;
        this.timer = null;
        this.active = false;
        this.paused = true;

        moment.locale(locales.lang);
    }

    /**
     * Add initial timelapse option button.
     */
    create() {
        this.button = this.options.append("div")
            .classed("column is-narrow", true)
            .append("p")
            .classed("control", true)
            .append("button")
            .attr("id", "timelapse-button")
            .classed("button is-small tooltip", true)
            .text(this.locales.message("timelapse"))
            .attr("data-tooltip", this.locales.message("timelapse-title"))
            .on("click", () => { this.toggle(); });
    }

    /**
     * Enable or disable timelapse mode based on its current state.
     * Stop the timelapse if it is active, otherwise start it from the begin.
     */
    toggle() {
        if (this.active) {
            this.stop();
        }
        else {
            this.start();
        }
    }

    makeTimer() {
        this.timer = d3.interval(() => { this.tick(); }, this.speed, d3.now());
    }

    /**
     * Start the timelapse.
     */
    start() {
        this.active = true;
        this.button.text(this.locales.message("timelapse-complete"))
            .attr("data-tooltip", this.locales.message("timelapse-complete-title"));

        this.options.selectAll('.regular-option')
            .attr('disabled', true);

        // Initialize the timelapse
        this.network.startTimelapse(intervalFile(this.intervals[9]));

        // Add a play/pause button to the timelapse
        let column = this.options.append('div')
            .classed('column is-narrow timelapse', true)
            .append('div')
            .classed('buttons has-addons', true);
        column.append("button")
            .classed("button is-small tooltip", true)
            .attr("id", "pauseButton")
            .attr('data-tooltip', this.locales.message('pause-title'))
            .on("click", () => { this.togglePlayPause(); })
            .append("span")
            .classed("icon", true)
            .append("i")
            .classed("fas fa-pause", true);

        column.append("button")
            .classed("button is-small speedButton slower tooltip", true)
            .attr('data-tooltip', this.locales.message('speed-slower-title'))
            .on("click", () => { this.decreaseSpeed(); })
            .append("span")
            .classed("icon", true)
            .append("i")
            .classed("fas fa-minus", true);

        column.append("button")
            .classed("button is-small speedButton faster tooltip", true)
            .attr('data-tooltip', this.locales.message('speed-faster-title'))
            .on("click", () => { this.increaseSpeed(); })
            .append("span")
            .classed("icon", true)
            .append("i")
            .classed("fas fa-plus", true);

        // Keyboard shortcuts for timelapse options
        Mousetrap.bind(['+', '=', 'plus'], () => { this.increaseSpeed(); });
        Mousetrap.bind('-', () => { this.decreaseSpeed(); });
        Mousetrap.bind('0', () => { this.togglePlayPause(); });

        // Create the heading for the date indication
        this.options.append("div")
            .classed("column timelapse has-text-right", true)
            .append('h3')
            .attr("id", "timelapse-date");

        this.index = 0;
        this.paused = false;
        this.speed = 1500; // Default speed is one tick per 1.5 seconds. Lower is faster.

        // Start the timelapse
        this.makeTimer();
        this.tick();
    }

    /**
     * Callback which is invoked for each timer tick.
     */
    tick() {
        if (this.paused) {
            this.timer.stop();
        }
        else if (this.index < this.intervals.length) {
            let d = new Date(0);
            d.setUTCSeconds(this.intervals[this.index]);

            this.options.select('#timelapse-date')
                .text(`${moment(d).format('MMMM YYYY')}`);

            this.network.timelapseTick(intervalFile(this.intervals[this.index]), moment(d));

            this.index++;
        }
        else {
            this.button.classed("is-link is-selected", true);
            this.options.select('#pauseButton')
                .attr('disabled', true)
                .attr('data-tooltip', this.locales.message('stop-title'))
                .select('i')
                .classed('fa-pause fa-play', false)
                .classed('fa-stop', true);
            this.timer.stop();
        }
    }

    /**
     * Toggle the play/pause setting.
     */
    togglePlayPause() {
        if (this.paused) {
            this.paused = false;
            this.tick();
            this.makeTimer();
            this.options.select("#pauseButton")
                .attr('data-tooltip', this.locales.message('pause-title'))
                .select('i')
                .classed('fa-play', false)
                .classed('fa-pause', true);
        } else {
            this.paused = true;
            this.options.select("#pauseButton")
                .attr('data-tooltip', this.locales.message('play-title'))
                .select('i')
                .classed('fa-pause', false)
                .classed('fa-play', true);
        }
    }

    /**
     * Increase the timelapse speed one step, if below theshold.
     */
    increaseSpeed() {
        if (this.speed > highestSpeed) {
            this.speed -= 500;
            this.timer.stop();
            this.makeTimer();

            if (this.speed < lowestSpeed) {
                this.options.select(".speedButton.slower")
                    .attr("disabled", null);
            }
        } else {
            this.options.select(".speedButton.faster")
                .attr("disabled", true);
        }
    }

    /**
     * Decrease the timelapse speed one step, if above threshold
     */
    decreaseSpeed() {
        if (this.speed < lowestSpeed) {
            this.speed += 500;
            this.timer.stop();
            this.makeTimer();

            if (this.speed > highestSpeed) {
                this.options.select(".speedButton.faster")
                    .attr("disabled", null);
            }
        } else {
            this.options.select(".speedButton.slower")
                .attr("disabled", true);
        }
    }

    /**
     * Stop the timelapse.
     */
    stop() {
        if (this.timer) {
            this.timer.stop();
            this.timer = null;
        }
        this.active = false;
        this.paused = true;

        this.button.classed("is-info is-selected", false)
            .text(this.locales.message("timelapse"))
            .attr("data-tooltip", this.locales.message("timelapse-title"));

        this.options.selectAll('.regular-option')
            .attr('disabled', null);
        this.options.selectAll('.timelapse')
            .remove();

        this.network.stopTimelapse();
    }
}
