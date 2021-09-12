import {Component, ElementRef, OnInit} from '@angular/core';
import {DataService} from "./data.service";
import * as d3 from 'd3';
import * as prettyBytes from "pretty-bytes";
import {forkJoin} from "rxjs";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Disk Treemap';

  constructor(private dataService: DataService,
              private hostElement: ElementRef) {
  }

  ngOnInit(): void {
    forkJoin([
      this.dataService.getSizeTree(),
      this.dataService.getInfo(),
    ]).subscribe(results => {
      const data = results[0]
      const info = results[1]

      function prepareData(d: Map<string, any>): Map<string, any>[] {
        const nodes = []
        for (const [key, value] of Object.entries(d)) {
          const node = {name: key}
          if (typeof (value) === 'number') {
            if (value !== 0) {
              node['value'] = value;
              nodes.push(node)
            }
          } else {
            node['children'] = prepareData(value)
            nodes.push(node)
          }
        }
        return nodes;
      }

      const hierarchyNode = d3.hierarchy({name: '', children: prepareData(data), value: null})
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
      let count = 0;
      const DOM = {
        uid: function (e) {
          count++;
          return {
            id: `O-${e}-${count}`
          }
        }
      }


      const format = prettyBytes;
      const height = window.innerHeight - 38;
      const width = window.innerWidth;
      const name = d => d.ancestors().reverse().map(d => d.data.name).filter(d => d.length > 0)
        // .filter((d, i) => !(i == 0 && d === info.sep))
        .map((d, i, a) => (i === 0 && d === info.sep && a.length > 1) ? '' : d)
        .join(info.sep);

      function tile(node, x0, y0, x1, y1) {
        d3.treemapBinary(node, 0, 0, width, height);
        for (const child of node.children) {
          child.x0 = x0 + child.x0 / width * (x1 - x0);
          child.x1 = x0 + child.x1 / width * (x1 - x0);
          child.y0 = y0 + child.y0 / height * (y1 - y0);
          child.y1 = y0 + child.y1 / height * (y1 - y0)


        }
      }

      const treemap = d3.treemap().tile(tile)(hierarchyNode)

      const x = d3.scaleLinear().rangeRound([0, width]);
      const y = d3.scaleLinear().rangeRound([0, height]);

      const svg = d3.select(this.hostElement.nativeElement).append("svg")
        .attr('viewBox', `0.5 -30.5 ${width} ${height + 30}`)
        .style('font', '14px sans-serif');

      let group = svg.append('g')
        .call(render, treemap);

      function render(group, root) {
        const node = group
          .selectAll('g')
          .data(root.children.concat(root))
          .join('g')
          .filter(d => (x(d.x1) - x(d.x0) > 1) && (y(d.y1) - y(d.y0) > 1))
          .filter((d, i, a) => i < 1000 || i === a.length - 1);

        node.filter(d => d === root ? d.parent : d.children)
          .attr('cursor', 'pointer')
          .on('click', d => d === root ? zoomout(root) : zoomin(d));

        node.append('title')
          .text(d => `${name(d)}\n${format(d.value)}`);

        node.append('rect')
          .attr('id', d => (d.leafUid = DOM.uid('leaf')).id)
          .attr('fill', d => d === root ? '#fff' : d.children ? '#ccc' : '#ddd')
          .attr('stroke', '#fff');

        node.append('clipPath')
          .attr('id', d => (d.clipUid = DOM.uid('clip')).id)
          .append('use')
          .attr('xlink:href', d => d.leafUid.href);

        node.append('text')
          .attr('clip-path', d => d.clipUid)
          .attr('font-weight', d => d === root ? 'bold' : null)
          .selectAll('tspan')
          .data(d => [(d === root ? name(d) : d.data.name), format(d.value)])
          .join('tspan')
          .attr('x', 3)
          .attr("y", (d, i, nodes) => `${((i === nodes.length - 1) ? 0 : 1) * 0.2 + 0.9 + i * 1.2}em`)
          .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
          .attr("font-weight", (d, i, nodes) => i === nodes.length - 1 ? "normal" : null)
          .text(d => d);

        group.call(position, root);
      }

      function position(group, root) {
        group.selectAll("g")
          .attr("transform", d => d === root ? `translate(0,-30)` : `translate(${x(d.x0)},${y(d.y0)})`)
          .select("rect")
          .attr("width", d => d === root ? width : x(d.x1) - x(d.x0))
          .attr("height", d => d === root ? 30 : y(d.y1) - y(d.y0));
      }

      // When zooming in, draw the new nodes on top, and fade them in.
      function zoomin(d) {
        const group0 = group.attr("pointer-events", "none");
        const group1 = group = svg.append("g").call(render, d);

        x.domain([d.x0, d.x1]);
        y.domain([d.y0, d.y1]);

        svg.transition()
          .duration(750)
          .call(t => group0.transition(t).remove()
            .call(position, d.parent))
          .call(t => group1.transition(t)
            .attrTween("opacity", () => t => d3.interpolate(0, 1)(t).toString())
            .call(position, d));
      }

      function zoomout(d) {
        const group0 = group.attr("pointer-events", "none");
        const group1 = group = svg.insert("g", "*").call(render, d.parent);

        x.domain([d.parent.x0, d.parent.x1]);
        y.domain([d.parent.y0, d.parent.y1]);

        svg.transition()
          .duration(500)
          .call(t => group0.transition(t).remove()
            .attrTween("opacity", () => t => d3.interpolate(1, 0)(t).toString())
            .call(position, d))
          .call(t => group1.transition(t)
            .call(position, d.parent));
      }

    });
  }

}
