import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { isNamedType, GraphQLSchema } from 'graphql'
import { List } from 'immutable'

// Query & Response Components
import ExecuteButton from './ExecuteButton'
import QueryEditor from './QueryEditor'
import EditorWrapper, { Container } from './EditorWrapper'
import CodeMirrorSizer from 'graphiql/dist/utility/CodeMirrorSizer'
import TopBar from './TopBar/TopBar'
import {
  VariableEditorComponent,
  HeadersEditorComponent,
} from './VariableEditor'
import Spinner from '../Spinner'
import Results from './Results'
import ResponseTracing from './ResponseTracing'
import { fillLeafs } from 'graphiql/dist/utility/fillLeafs'
import { getLeft, getTop } from 'graphiql/dist/utility/elementPosition'

// Explorer Components
import SideTab from './ExplorerTabs/SideTab'
import SideTabs from './ExplorerTabs/SideTabs'
import SDLView from './SchemaExplorer/SDLView'
import GraphDocs from './DocExplorer/GraphDocs'

import { styled } from '../../styled/index'

// Redux Dependencies
import { connect } from 'react-redux'
import { createStructuredSelector } from 'reselect'
import {
  getQueryRunning,
  getResponses,
  getSubscriptionActive,
  getVariableEditorOpen,
  getVariableEditorHeight,
  getResponseTracingOpen,
  getResponseTracingHeight,
  getResponseExtensions,
  getCurrentQueryStartTime,
  getCurrentQueryEndTime,
  getTracingSupported,
  getEditorFlex,
  getQueryVariablesActive,
  getHeaders,
  getOperations,
  getOperationName,
  getHeadersCount,
  getSelectedSessionIdFromRoot,
} from '../../state/sessions/selectors'
import {
  updateQueryFacts,
  stopQuery,
  runQueryAtPosition,
  closeQueryVariables,
  openQueryVariables,
  openVariables,
  closeVariables,
  openTracing,
  closeTracing,
  toggleTracing,
  setEditorFlex,
  toggleVariables,
  fetchSchema,
} from '../../state/sessions/actions'
import { ResponseRecord } from '../../state/sessions/reducers'
import { getDocsOpen } from '../../state/docs/selectors'
import { changeWidthDocs } from '../../state/docs/actions'

/**
 * The top-level React component for GraphQLEditor, intended to encompass the entire
 * browser viewport.
 */

export interface Props {
  onRef?: any
  shareEnabled?: boolean
  fixedEndpoint?: boolean
  schema?: GraphQLSchema
}

export interface ReduxProps {
  setStacks: (sessionId: string, stack: any[]) => void
  updateQueryFacts: () => void
  runQueryAtPosition: (position: number) => void
  fetchSchema: () => void
  openQueryVariables: () => void
  closeQueryVariables: () => void
  openVariables: (height: number) => void
  closeVariables: (height: number) => void
  openTracing: (height: number) => void
  closeTracing: (height: number) => void
  toggleTracing: () => void
  toggleVariables: () => void
  setEditorFlex: (flex: number) => void
  stopQuery: (sessionId: string) => void
  changeWidthDocs: (sessionId: string, width: number) => void
  navStack: any[]
  docsOpen: boolean
  // sesion props
  queryRunning: boolean
  responses: List<ResponseRecord>
  subscriptionActive: boolean
  variableEditorOpen: boolean
  variableEditorHeight: number
  currentQueryStartTime?: Date
  currentQueryEndTime?: Date
  responseTracingOpen: boolean
  responseTracingHeight: number
  responseExtensions: any
  tracingSupported?: boolean
  editorFlex: number
  headers: string
  headersCount: number
  queryVariablesActive: boolean
  operationName: string
  query: string
  sessionId: string
}

export interface SimpleProps {
  children?: any
}

export interface ToolbarButtonProps extends SimpleProps {
  onClick: (e: any) => void
  title: string
  label: string
}

class GraphQLEditor extends React.PureComponent<Props & ReduxProps> {
  public codeMirrorSizer
  public queryEditorComponent
  public variableEditorComponent
  public resultComponent
  public editorBarComponent
  public docExplorerComponent: any // later React.Component<...>
  public graphExplorerComponent: any
  public schemaExplorerComponent: any
  private queryResizer: any
  private responseResizer: any
  private queryVariablesRef
  private httpHeadersRef
  private containerComponent
  private activeSideTabContent

  componentDidMount() {
    // Ensure a form of a schema exists (including `null`) and
    // if not, fetch one using an introspection query.
    // this.props.fetchSchema()

    // Utility for keeping CodeMirror correctly sized.
    this.codeMirrorSizer = new CodeMirrorSizer()
    ;(global as any).g = this
  }

  componentDidUpdate() {
    // If this update caused DOM nodes to have changed sizes, update the
    // corresponding CodeMirror instance sizes to match.
    // const components = [
    // this.queryEditorComponent,
    // this.variableEditorComponent,
    // this.resultComponent,
    // ]
    // this.codeMirrorSizer.updateSizes(components)
    if (this.resultComponent && Boolean(this.props.subscriptionActive)) {
      this.resultComponent.scrollTop = this.resultComponent.scrollHeight
    }
  }

  render() {
    return (
      <Container ref={this.setContainerComponent}>
        <EditorWrapper>
          <TopBar
            shareEnabled={this.props.shareEnabled}
          />
          <EditorBar
            ref={this.setEditorBarComponent}
            onMouseDown={this.handleResizeStart}
          >
            <QueryWrap flex={this.props.editorFlex}>
              <QueryEditor
                getRef={this.setQueryEditorComponent}
                schema={this.props.schema}
                onHintInformationRender={this.handleHintInformationRender}
                onRunQuery={this.runQueryAtCursor}
                onClickReference={this.handleClickReference}
              />
              <VariableEditor
                isOpen={this.props.variableEditorOpen}
                height={this.props.variableEditorHeight}
              >
                <VariableEditorTitle
                  isOpen={this.props.variableEditorOpen}
                  onMouseDown={this.handleVariableResizeStart}
                >
                  <VariableEditorSubtitle
                    isOpen={this.props.queryVariablesActive}
                    ref={this.setQueryVariablesRef}
                    onClick={this.props.openQueryVariables}
                  >
                    Query Variables
                  </VariableEditorSubtitle>
                  <VariableEditorSubtitle
                    isOpen={!this.props.queryVariablesActive}
                    ref={this.setHttpHeadersRef}
                    onClick={this.props.closeQueryVariables}
                  >
                    {'HTTP Headers ' +
                      (this.props.headersCount && this.props.headersCount > 0
                        ? `(${this.props.headersCount})`
                        : '')}
                  </VariableEditorSubtitle>
                </VariableEditorTitle>
                {this.props.queryVariablesActive ? (
                  <VariableEditorComponent
                    getRef={this.setVariableEditorComponent}
                    onHintInformationRender={
                      this.props.queryVariablesActive
                        ? this.handleHintInformationRender
                        : undefined
                    }
                    onRunQuery={this.runQueryAtCursor}
                  />
                ) : (
                  <HeadersEditorComponent
                    getRef={this.setVariableEditorComponent}
                    onHintInformationRender={
                      this.props.queryVariablesActive
                        ? this.handleHintInformationRender
                        : undefined
                    }
                    onRunQuery={this.runQueryAtCursor}
                  />
                )}
              </VariableEditor>
              <QueryDragBar ref={this.setQueryResizer} />
            </QueryWrap>
            <ResultWrap>
              <ResultDragBar ref={this.setResponseResizer} />
              <ExecuteButton />
              {this.props.queryRunning &&
                this.props.responses.size === 0 && <Spinner />}
              <Results setRef={this.setResultComponent} />
              {!this.props.queryRunning &&
                (!this.props.responses || this.props.responses.size === 0) && (
                  <Intro>Press the Play Button to get a response here</Intro>
                )}
              {this.props.subscriptionActive && (
                <Listening>Listening &hellip;</Listening>
              )}
              <ResponseTracking
                isOpen={this.props.responseTracingOpen}
                height={this.props.responseTracingHeight}
              >
                <ResponseTrackingTitle
                  isOpen={this.props.responseTracingOpen}
                  onMouseDown={this.handleTracingResizeStart}
                >
                  <VariableEditorSubtitle isOpen={false}>
                    Tracing
                  </VariableEditorSubtitle>
                </ResponseTrackingTitle>
                <ResponseTracing open={this.props.responseTracingOpen} />
              </ResponseTracking>
            </ResultWrap>
          </EditorBar>
        </EditorWrapper>
        <SideTabs
          sessionId={this.props.sessionId}
          schema={this.props.schema}
          setActiveContentRef={this.setSideTabActiveContentRef}
          setWidth={this.setDocsWidth}
          maxWidth={10000}
        >
          <SideTab label="Docs" activeColor="green" tabWidth="49px">
            <GraphDocs
              schema={this.props.schema}
              ref={this.setDocExplorerRef}
            />
          </SideTab>
          <SideTab label="Schema" activeColor="blue" tabWidth="65px">
            <SDLView
              schema={this.props.schema}
              ref={this.setSchemaExplorerRef}
              sessionId={this.props.sessionId}
              setWidth={this.setDocsWidth}
            />
          </SideTab>
        </SideTabs>
      </Container>
    )
  }

  setQueryVariablesRef = ref => {
    this.queryVariablesRef = ref
  }

  setHttpHeadersRef = ref => {
    this.httpHeadersRef = ref
  }

  setQueryResizer = ref => {
    this.queryResizer = ReactDOM.findDOMNode(ref)
  }

  setResponseResizer = ref => {
    this.responseResizer = ReactDOM.findDOMNode(ref)
  }

  setEditorBarComponent = ref => {
    this.editorBarComponent = ref
  }

  setQueryEditorComponent = ref => {
    this.queryEditorComponent = ref
  }

  setVariableEditorComponent = ref => {
    this.variableEditorComponent = ref
  }

  setResultComponent = ref => {
    this.resultComponent = ref
  }

  setDocExplorerRef = ref => {
    if (ref) {
      this.docExplorerComponent = ref.getWrappedInstance()
    }
  }
  setGraphExplorerRef = ref => {
    if (ref) {
      this.graphExplorerComponent = ref.getWrappedInstance()
    }
  }
  setSchemaExplorerRef = ref => {
    if (ref) {
      this.schemaExplorerComponent = ref
    }
  }
  setContainerComponent = ref => {
    this.containerComponent = ref
  }

  handleClickReference = reference => {
    if (this.docExplorerComponent) {
      this.docExplorerComponent.showDocFromType(reference.field || reference)
    }
  }

  setSideTabActiveContentRef = ref => {
    if (ref) {
      this.activeSideTabContent = ref
    }
  }

  /**
   * Inspect the query, automatically filling in selection sets for non-leaf
   * fields which do not yet have them.
   *
   * @public
   */
  autoCompleteLeafs() {
    const { insertions, result } = fillLeafs(
      this.props.schema,
      this.props.query,
    ) as {
      insertions: Array<{ index: number; string: string }>
      result: string
    }
    if (insertions && insertions.length > 0) {
      const editor = this.queryEditorComponent.getCodeMirror()
      editor.operation(() => {
        const cursor = editor.getCursor()
        const cursorIndex = editor.indexFromPos(cursor)
        editor.setValue(result)
        let added = 0
        try {
          /* tslint:disable-next-line */
          const markers = insertions.map(({ index, string }) =>
            editor.markText(
              editor.posFromIndex(index + added),
              editor.posFromIndex(index + (added += string.length)),
              {
                className: 'autoInsertedLeaf',
                clearOnEnter: true,
                title: 'Automatically added leaf fields',
              },
            ),
          )
          setTimeout(() => markers.forEach(marker => marker.clear()), 7000)
        } catch (e) {
          //
        }
        let newCursorIndex = cursorIndex
        /* tslint:disable-next-line */
        insertions.forEach(({ index, string }) => {
          if (index < cursorIndex && string) {
            newCursorIndex += string.length
          }
        })
        editor.setCursor(editor.posFromIndex(newCursorIndex))
      })
    }

    return result
  }

  private runQueryAtCursor = () => {
    if (this.props.queryRunning) {
      this.props.stopQuery(this.props.sessionId)
      return
    }

    const editor = this.queryEditorComponent.getCodeMirror()
    const cursor = editor.getCursor()
    const cursorIndex = editor.indexFromPos(cursor)
    this.props.runQueryAtPosition(cursorIndex)
  }

  private handleHintInformationRender = elem => {
    elem.addEventListener('click', this.onClickHintInformation)

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((removedNode) => {
          if (removedNode === elem) {
            elem.removeEventListener('click', this.onClickHintInformation);
            observer.disconnect();
          }
        });
      });
    });

    observer.observe(elem, { childList: true });
  }

  private handleResizeStart = downEvent => {
    if (!this.didClickDragBar(downEvent)) {
      return
    }

    downEvent.preventDefault()

    const offset = downEvent.clientX - getLeft(downEvent.target)

    let onMouseMove: any = moveEvent => {
      if (moveEvent.buttons === 0) {
        return onMouseUp()
      }

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent) as Element
      const leftSize = moveEvent.clientX - getLeft(editorBar) - offset
      const rightSize = editorBar.clientWidth - leftSize
      this.props.setEditorFlex(leftSize / rightSize)
    }

    let onMouseUp: any = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      onMouseMove = null
      onMouseUp = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  private didClickDragBar(event) {
    // Only for primary unmodified clicks
    return (
      event.target === this.queryResizer ||
      event.target === this.responseResizer
    )
  }

  private handleTracingResizeStart = downEvent => {
    downEvent.preventDefault()

    let didMove = false
    const hadHeight = this.props.responseTracingHeight
    const offset = downEvent.clientY - getTop(downEvent.target)

    let onMouseMove: any = moveEvent => {
      if (moveEvent.buttons === 0) {
        return onMouseUp()
      }

      didMove = true

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent) as Element
      const topSize = moveEvent.clientY - getTop(editorBar) - offset
      const bottomSize = editorBar.clientHeight - topSize
      if (bottomSize < 60) {
        this.props.closeTracing(hadHeight)
      } else {
        this.props.openTracing(hadHeight)
      }
    }

    let onMouseUp: any = () => {
      if (!didMove) {
        this.props.toggleTracing()
      }

      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      onMouseMove = null
      onMouseUp = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  private handleVariableResizeStart = downEvent => {
    downEvent.preventDefault()

    let didMove = false
    const wasOpen = this.props.variableEditorOpen
    const hadHeight = this.props.variableEditorHeight
    const offset = downEvent.clientY - getTop(downEvent.target)

    if (
      wasOpen &&
      (downEvent.target === this.queryVariablesRef ||
        downEvent.target === this.httpHeadersRef)
    ) {
      return
    }

    let onMouseMove: any = moveEvent => {
      if (moveEvent.buttons === 0) {
        return onMouseUp()
      }

      didMove = true

      const editorBar = ReactDOM.findDOMNode(this.editorBarComponent) as Element
      const topSize = moveEvent.clientY - getTop(editorBar) - offset
      const bottomSize = editorBar.clientHeight - topSize
      if (bottomSize < 60) {
        this.props.closeVariables(hadHeight)
      } else {
        this.props.openVariables(bottomSize)
      }
    }

    let onMouseUp: any = () => {
      if (!didMove) {
        this.props.toggleVariables()
      }

      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      onMouseMove = null
      onMouseUp = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  private onClickHintInformation = event => {
    if (event.target.className === 'typeName') {
      const typeName = event.target.innerHTML
      const schema = this.props.schema
      if (schema) {
        // TODO: There is no way as of now to retrieve the NAMED_TYPE of a GraphQLList(Type).
        // We're therefore removing any '[' or '!' characters, to properly find its NAMED_TYPE. (eg. [Type!]! => Type)
        // This should be removed as soon as there's a safer way to do that.
        const namedTypeName = typeName.replace(/[\]\[!]/g, '')
        const type = schema.getType(namedTypeName)

        if (isNamedType(type)) {
          this.docExplorerComponent.showDocFromType(type)
        }
      }
    }
  }

  private setDocsWidth = (props: any = this.props) => {
    if (!this.activeSideTabContent) {
      return
    }
    if (!this.props.docsOpen) {
      return
    }
    requestAnimationFrame(() => {
      const width = this.activeSideTabContent.getWidth()
      const maxWidth = this.containerComponent.getWidth() - 86
      this.props.changeWidthDocs(props.sessionId, Math.min(width, maxWidth))
    })
  }
}

const mapStateToProps = createStructuredSelector({
  queryRunning: getQueryRunning,
  responses: getResponses,
  subscriptionActive: getSubscriptionActive,
  variableEditorOpen: getVariableEditorOpen,
  variableEditorHeight: getVariableEditorHeight,
  responseTracingOpen: getResponseTracingOpen,
  responseTracingHeight: getResponseTracingHeight,
  responseExtensions: getResponseExtensions,
  currentQueryStartTime: getCurrentQueryStartTime,
  currentQueryEndTime: getCurrentQueryEndTime,
  tracingSupported: getTracingSupported,
  editorFlex: getEditorFlex,
  queryVariablesActive: getQueryVariablesActive,
  headers: getHeaders,
  operations: getOperations,
  operationName: getOperationName,
  headersCount: getHeadersCount,
  sessionId: getSelectedSessionIdFromRoot,
  docsOpen: getDocsOpen,
})

export default // TODO fix redux types
connect<any, any, any>(
  mapStateToProps,
  {
    updateQueryFacts,
    stopQuery,
    runQueryAtPosition,
    openQueryVariables,
    closeQueryVariables,
    openVariables,
    closeVariables,
    openTracing,
    closeTracing,
    toggleTracing,
    setEditorFlex,
    toggleVariables,
    fetchSchema,
    changeWidthDocs,
  },
  null,
  {
    forwardRef: true,
  },
)(GraphQLEditor)

const EditorBar = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;
  height: 100%;
`

const ResultWrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  position: relative;
  border-left: none;
  background: ${p => p.theme.editorColours.resultBackground};
  overflow-anchor: auto;
`

const DragBar = styled.div`
  width: 15px;
  position: absolute;
  top: 0;
  bottom: 0;
  cursor: col-resize;
`

const QueryDragBar = styled(DragBar)`
  right: 0px;
`

const ResultDragBar = styled(DragBar)`
  left: 0px;
  z-index: 1;
`

interface DrawerProps {
  isOpen: boolean
  height: number
}

const BottomDrawer = styled<DrawerProps, 'div'>('div')`
  display: flex;
  background: #0b1924;
  flex-direction: column;
  position: relative;
  height: ${props => (props.isOpen ? `${props.height}px` : '43px')};
`

interface TitleProps {
  isOpen: boolean
  onMouseDown?: any
  onClick?: any
  ref?: any
}

const BottomDrawerTitle = styled.div`
  background: #0b1924;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.53px;
  line-height: 14px;
  font-size: 14px;
  padding: 14px 14px 15px 21px;
  user-select: none;
`

const VariableEditor = styled(BottomDrawer)`
  .CodeMirror {
    padding-left: 4px;
    width: calc(100% - 4px);
    background: ${p => p.theme.editorColours.leftDrawerBackground};
  }
  .CodeMirror-lines {
    padding: 10px 0 20px 0;
  }
  .CodeMirror-linenumbers {
    background: ${p => p.theme.editorColours.leftDrawerBackground};
  }
`

const VariableEditorTitle = styled<TitleProps>(({ isOpen, ...rest }) => (
  <BottomDrawerTitle {...rest} />
))`
  cursor: ${p => (p.isOpen ? 'row-resize' : 'n-resize')};
  background: ${p => p.theme.editorColours.leftDrawerBackground};
`

const VariableEditorSubtitle = styled<TitleProps, 'span'>('span')`
  margin-right: 10px;
  cursor: pointer;
  color: ${p =>
    p.isOpen
      ? p.theme.editorColours.drawerText
      : p.theme.editorColours.drawerTextInactive};
  &:last-child {
    margin-right: 0;
  }
`

const ResponseTracking = styled(BottomDrawer)`
  background: ${p => p.theme.editorColours.rightDrawerBackground};
`

const ResponseTrackingTitle = styled<TitleProps>(({ isOpen, ...rest }) => (
  <BottomDrawerTitle {...rest} />
))`
  text-align: right;
  background: ${p => p.theme.editorColours.rightDrawerBackground};
  cursor: ${props => (props.isOpen ? 's-resize' : 'n-resize')};
  color: ${p => p.theme.editorColours.drawerTextInactive};
`

interface QueryProps {
  flex: number
}

const QueryWrap = styled<QueryProps, 'div'>('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: ${props => props.flex} 1 0%;
  border-top: 8px solid ${props => props.theme.editorColours.resultBackground};
`

const Intro = styled.div`
  width: 235px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: ${p => p.theme.colours.textInactive};
  font-size: ${p => p.theme.sizes.small16};
  font-family: 'Source Code Pro', 'Consolas', 'Inconsolata', 'Droid Sans Mono',
    'Monaco', monospace;
  text-align: center;
  letter-spacing: 0.6px;
`

const Listening = styled.div`
  position: absolute;
  bottom: 0;
  color: ${p => p.theme.editorColours.text};
  background: ${p => p.theme.editorColours.resultBackground};
  font-size: ${p => p.theme.sizes.small16};
  font-family: ${p => p.theme.settings['editor.fontFamily']};
  letter-spacing: 0.6px;
  padding-left: 24px;
  padding-bottom: 60px;
`
