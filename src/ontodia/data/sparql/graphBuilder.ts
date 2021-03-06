import { keyBy } from 'lodash';

import { LayoutData, LayoutCell, LayoutElement, LayoutLink } from '../../diagram/layoutData';
import { uniformGrid } from '../../viewUtils/layout';
import { Dictionary, ElementModel, LinkModel } from '../model';
import { generate64BitID } from '../utils';

import { DataProvider } from '../provider';
import { Triple } from './sparqlModels';
import { parseTurtleText } from './turtle';

const GREED_STEP = 150;

export class GraphBuilder {
    constructor(public dataProvider: DataProvider) {}

    createGraph(graph: { elementIds: string[], links: LinkModel[] }): Promise<{
        preloadedElements: Dictionary<ElementModel>,
        layoutData: LayoutData,
    }> {
        return this.dataProvider.elementInfo({elementIds: graph.elementIds}).then(elementsInfo => ({
            preloadedElements: elementsInfo,
            layoutData: this.getLayout(graph.elementIds, graph.links),
        }));
    }

    getGraphFromRDFGraph(graph: Triple[]): Promise<{
        preloadedElements: Dictionary<ElementModel>,
        layoutData: LayoutData,
    }> {
        let {elementIds, links} = this.getGraphElements(graph);
        return this.createGraph({elementIds, links});
    };

    getGraphFromTurtleGraph(graph: string): Promise<{
        preloadedElements: Dictionary<ElementModel>,
        layoutData: LayoutData,
    }> {
        return parseTurtleText(graph).then(triples => this.getGraphFromRDFGraph(triples));
    }

    private getGraphElements(response: Triple[]): {
        elementIds: string[], links: LinkModel[]
    } {
        const elements: Dictionary<boolean> = {};
        const links: LinkModel[] = [];

        for (const {subject, predicate, object} of response) {
            if (subject.type === 'uri' && !elements[subject.value]) {
                elements[subject.value] = true;
            }

            if (object.type === 'uri' && !elements[object.value]) {
                elements[object.value] = true;
            }

            if (subject.type === 'uri' && object.type === 'uri') {
                links.push({
                    linkTypeId: predicate.value,
                    sourceId: subject.value,
                    targetId: object.value,
                });
            }
        }
        return {elementIds: Object.keys(elements), links: links};
    }

    private getLayout(elementsIds: string[], linksInfo: LinkModel[]): LayoutData {
        const rows = Math.ceil(Math.sqrt(elementsIds.length));
        const grid = uniformGrid({rows, cellSize: {x: GREED_STEP, y: GREED_STEP}});

        const layoutElements: LayoutCell[] = elementsIds.map<LayoutElement>((id, index) => {
            const {x, y} = grid(index);
            return {type: 'element', id: `element_${generate64BitID()}`, iri: id, position: {x, y}};
        });

        const layoutElementsMap: {[iri: string]: LayoutCell} = keyBy(layoutElements, 'iri');
        const layoutLinks: LayoutLink[] = [];

        linksInfo.forEach((link, index) => {
            const source = layoutElementsMap[link.sourceId];
            const target = layoutElementsMap[link.targetId];

            if (!source || !target) { return; }

            layoutLinks.push({
                type: 'link',
                id: `link_${generate64BitID()}`,
                typeId: link.linkTypeId,
                source: {id: source.id},
                target: {id: target.id},
            })
        });
        return {cells: layoutElements.concat(layoutLinks)};
    }
}

export default GraphBuilder;
