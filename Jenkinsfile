pipeline {
    agent { label 'docker' }

    environment {
        IMAGE_TAG = env.BRANCH_NAME.replaceFirst('^master$', 'latest')
        GITLAB_TOKEN = credentials('collaboration-graph-gitlab-token')
        SCANNER_HOME = tool name: 'SonarQube Scanner 3', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
    }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All', secretToken: env.GITLAB_TOKEN)
        cron(env.VISUALIZATION_CRON)
    }

    post {
        failure {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'failed'
        }
        aborted {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'canceled'
        }
    }

    stages {
        stage('Start') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'running'
            }
        }
        stage('Build') {
            steps {
                sh 'docker build -t $DOCKER_REGISTRY/gros-collaboration-graph:$IMAGE_TAG . --build-arg NPM_REGISTRY=$NPM_REGISTRY'
            }
        }
        stage('SonarQube Analysis') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '${SCANNER_HOME}/bin/sonar-scanner -Dsonar.branch=$BRANCH_NAME'
                }
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'docker push $DOCKER_REGISTRY/gros-collaboration-graph:latest'
            }
        }
        stage('Collect') {
            when {
                anyOf {
                    branch 'master'
                    expression {
                        currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                    }
                }
            }
            agent {
                docker {
                    image '$DOCKER_REGISTRY/gros-data-analysis-dashboard'
                    reuseNode true
                }
            }
            steps {
                withCredentials([file(credentialsId: 'data-analysis-config', variable: 'ANALYSIS_CONFIGURATION')]) {
                    sh '/bin/bash -c "rm -rf $PWD/output && mkdir $PWD/output && cd /home/docker && Rscript report.r --report project_members --interval \'1 month\' $REPORT_PARAMS --log INFO --config $ANALYSIS_CONFIGURATION --output $PWD/output"'
                }
            }
        }
        stage('Visualize') {
            when {
                anyOf {
                    branch 'master'
                    expression {
                        currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                    }
                }
            }
            agent {
                docker {
                    image '$DOCKER_REGISTRY/gros-collaboration-graph:$IMAGE_TAG'
                    reuseNode true
                }
            }
            steps {
                withCredentials([file(credentialsId: 'collaboration-graph-config', variable: 'COLLABORATION_GRAPH_CONFIGURATION')]) {
                    sh 'rm -rf public/data/'
                    sh 'mkdir -p public/'
                    sh 'mv output/ public/data/'
                    sh 'rm -rf node_modules/'
                    sh 'ln -s /usr/src/app/node_modules .'
                    sh 'cp $COLLABORATION_GRAPH_CONFIGURATION config.json'
                    sh 'npm run production -- --env.mixfile=$PWD/webpack.mix.js'
                }
                publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'public', reportFiles: 'index.html', reportName: 'Visualization', reportTitles: ''])
            }
        }
        stage('Status') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
            }
        }
    }
}
