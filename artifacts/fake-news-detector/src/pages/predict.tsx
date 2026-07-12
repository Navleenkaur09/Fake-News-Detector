import { useState } from "react";
import { usePredictNews, useGetPredictionHistory, getGetPredictionHistoryQueryKey, PredictionResult, PredictionRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, RotateCcw, Clock, ArrowRight, Brain, Sparkles, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export default function Predict() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);

  const predictMutation = usePredictNews();
  
  // Also fetch prediction history to use all hooks as requested
  const { data: history } = useGetPredictionHistory(
    { limit: 5 },
    { query: { queryKey: getGetPredictionHistoryQueryKey({ limit: 5 }) } }
  );

  const handleAnalyze = () => {
    if (text.length < 10) return;
    
    predictMutation.mutate(
      { data: { text } },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      }
    );
  };

  const handleReset = () => {
    setText("");
    setResult(null);
    predictMutation.reset();
  };

  const isFake = result?.label === "FAKE";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Analysis Terminal</h1>
        <p className="text-muted-foreground">
          Enter an article body or headline to evaluate its authenticity using Google Gemini AI analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                Input Text
                {predictMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste news content, headline, or article URL here..."
                className="min-h-[250px] resize-y font-mono text-sm leading-relaxed p-4"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={predictMutation.isPending}
              />
              
              <div className="flex items-center justify-between mt-6">
                <span className="text-xs text-muted-foreground font-mono">
                  {text.length} characters
                </span>
                
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    disabled={predictMutation.isPending || (!text && !result)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={text.length < 10 || predictMutation.isPending}
                    className="min-w-[140px]"
                  >
                    {predictMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing
                      </>
                    ) : (
                      "Analyze Article"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <AnimatePresence mode="wait">
            {predictMutation.isError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="border-destructive/50 bg-destructive/10">
                  <CardContent className="p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-destructive">Analysis Failed</h4>
                      <p className="text-sm text-destructive/90 mt-1">
                        {(predictMutation.error as any)?.data?.error ||
                         (predictMutation.error as any)?.response?.data?.error || 
                         (predictMutation.error as any)?.message || 
                         "There was an error processing your request. Please try again."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Card className={`border-2 ${isFake ? 'border-destructive' : 'border-success'} overflow-hidden shadow-md`}>
                  <div className={`h-2 w-full ${isFake ? 'bg-destructive' : 'bg-success'}`} />
                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold flex items-center gap-2 mb-1">
                        {isFake ? (
                          <AlertCircle className="h-6 w-6 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-success" />
                        )}
                        Prediction: {result.label}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-3 font-mono text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Processed in {result.processingTimeMs}ms
                        </span>
                        {result.aiPowered ? (
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <Sparkles className="h-3 w-3" />
                            {(result as any).engine || "AI-Powered"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Cpu className="h-3 w-3" />
                            {(result as any).engine || "Rule-Based"}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={isFake ? "destructive" : "default"} className={`text-lg px-3 py-1 ${!isFake && "bg-success hover:bg-success/90"}`}>
                      {result.confidence.toFixed(1)}% Confident
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1.5 font-medium">
                          <span className="text-success">REAL Probability</span>
                          <span>{(result.realProbability * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={result.realProbability * 100} className="h-2 [&>div]:bg-success bg-success/20" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1.5 font-medium">
                          <span className="text-destructive">FAKE Probability</span>
                          <span>{(result.fakeProbability * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={result.fakeProbability * 100} className="h-2 [&>div]:bg-destructive bg-destructive/20" />
                      </div>
                    </div>

                    <div className="rounded-md bg-muted/50 p-4 border border-border/50">
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Summary
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {result.summary}
                      </p>
                    </div>

                    {(() => {
                      const parts = result.explanation.split("\n\n");
                      const reason = parts[0] ?? result.explanation;
                      const recommendation = parts[1];
                      return (
                        <div className="space-y-3">
                          <div className="rounded-md bg-muted/50 p-4 border border-border/50">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                              <Brain className="h-4 w-4 text-primary" />
                              Why this verdict?
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {reason}
                            </p>
                          </div>
                          {recommendation && (
                            <div className={`rounded-md p-4 border ${isFake ? "bg-destructive/5 border-destructive/30" : "bg-success/5 border-success/30"}`}>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                {isFake ? (
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                )}
                                <span className={isFake ? "text-destructive" : "text-success"}>
                                  {isFake ? "What should you do?" : "Recommendation"}
                                </span>
                              </h4>
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                {recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {result.keyWords && result.keyWords.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Key Influencing Words</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.keyWords.map((kw, i) => {
                            const isNegative = kw.sentiment === 'negative';
                            const isPositive = kw.sentiment === 'positive';
                            
                            return (
                              <Badge 
                                key={i} 
                                variant="outline"
                                className={`
                                  px-2 py-1 border-opacity-50
                                  ${isNegative ? 'bg-destructive/10 text-destructive border-destructive' : ''}
                                  ${isPositive ? 'bg-success/10 text-success border-success' : ''}
                                  ${!isNegative && !isPositive ? 'bg-muted text-muted-foreground' : ''}
                                `}
                              >
                                {kw.word}
                                <span className="ml-1.5 text-[10px] opacity-70 border-l pl-1.5 border-current">
                                  {kw.score.toFixed(2)}
                                </span>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Recent Scans</CardTitle>
              <CardDescription>Latest analyses by the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history?.length ? history.map((record: PredictionRecord) => (
                  <div key={record.id} className="group relative flex items-start space-x-3 rounded-lg border border-border/50 bg-card p-3 shadow-sm transition-all hover:bg-muted/50">
                    <div className={`mt-0.5 rounded-full p-1 ${record.label === 'FAKE' ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
                      {record.label === 'FAKE' ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-none mb-1 text-foreground truncate">
                        {record.text}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`font-semibold ${record.label === 'FAKE' ? 'text-destructive' : 'text-success'}`}>
                          {record.label}
                        </span>
                        <span>•</span>
                        <span>{record.confidence.toFixed(0)}% conf</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 h-6 w-6"
                      onClick={() => {
                        setText(record.text);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No recent predictions.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3">
              <p>
                Our models analyze lexical choice, syntactic structures, and semantic relationships to distinguish journalistic writing from disinformation.
              </p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-primary/50">
                <li>Extracts NLP features (TF-IDF, embeddings)</li>
                <li>Evaluates emotional sentiment & subjectivity</li>
                <li>Scores against known real/fake datasets</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
