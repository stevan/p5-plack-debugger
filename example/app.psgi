#!/usr/bin/env perl

use strict;
use warnings;

use Plack::Builder;
use Plack::Request; 

use JSON::XS;
use Path::Class qw[ dir ];
use UUID::Tiny  qw[ create_uuid_as_string UUID_V4 ];
use Time::HiRes qw[ gettimeofday tv_interval ];

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

use Plack::Debugger::Panel::Timer;
use Plack::Debugger::Panel::Response;
use Plack::Debugger::Panel::PerlConfig;
use Plack::Debugger::Panel::Parameters;
use Plack::Debugger::Panel::AJAX;

my $JSON         = JSON::XS->new->utf8->pretty;
my $DATA_DIR     = dir('/tmp/debugger_panel');
my $DEBUGGER_URL = Plack::App::Debugger->DEFAULT_BASE_URL;

# create tmp dir if needed
mkdir $DATA_DIR unless -e $DATA_DIR;

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger = Plack::Debugger->new(
    uid_generator => sub { create_uuid_as_string(UUID_V4) },
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => "%s.json",
    ),
    panels => [
        Plack::Debugger::Panel::Timer->new,
        Plack::Debugger::Panel::Parameters->new,        
        Plack::Debugger::Panel::Response->new,
        Plack::Debugger::Panel::PerlConfig->new,
        Plack::Debugger::Panel::AJAX->new, 
        Plack::Debugger::Panel->new(
            title     => 'Env',
            subtitle  => '... capturing the execution env',
            before    => sub { 
                my ($self, $env) = @_;
                $self->set_result({ %ENV }); 
            }
        ),
        Plack::Debugger::Panel->new(
            title => 'HTML Result Passthrough',
            after => sub { 
                my ($self, $env) = @_;
                $self->set_result(q{
                    <table>
                        <tr>
                            <td>Testing</td>
                            <td>1</td>
                            <td>2</td>
                            <td>3</td>
                        </tr>
                    </table>
                }); 
            }
        ),
        Plack::Debugger::Panel->new(
            title     => 'Plack Env',
            subtitle  => '... capturing the Plack env',
            before    => sub { 
                my ($self, $env) = @_;
                $self->set_result({ 
                    map { 
                        $_ => (ref $env->{ $_ } && ref $env->{ $_ } eq 'ARRAY' || ref $env->{ $_ } eq 'HASH'
                                ? $env->{ $_ } 
                                : (''.$env->{ $_ }))
                    } keys %$env 
                }); 
            }
        ),
        Plack::Debugger::Panel->new(
            title      => 'Warnings',
            before     => sub { 
                my ($self, $env) = @_;
                $self->stash([]);
                $SIG{'__WARN__'} = sub { 
                    push @{ $self->stash } => @_;
                    $self->notify('warning');
                    CORE::warn @_;
                };
            },
            after    => sub { 
                my ($self, $env) = @_;
                $SIG{'__WARN__'} = 'DEFAULT';  
                $self->set_result( $self->stash );
            }            
        ),
    ]
);

my $debugger_application = Plack::App::Debugger->new( debugger => $debugger );

builder {

    mount '/favicon.ico' => sub { [200,[],[]] };
 
    mount $DEBUGGER_URL => $debugger_application->to_app;

    mount '/' => builder {
        enable $debugger_application->make_injector_middleware;
        enable $debugger->make_collector_middleware;

        sub {
            my $r = Plack::Request->new( shift );

            warn "Starting request";

            if ( $r->path_info eq '/api' ) {
                warn "Sending AJAX JSON response";
                return [ 
                    200, 
                    [ 'Content-Type' => 'application/json' ], 
                    [ q[{"test":[1,2,3]}] ]
                ]
            }
            elsif ( $r->path_info eq '/api/v2' ) {
                warn "Sending AJAX JSON error response";
                return [ 500, [], [] ];
            }
            else {
                warn "Sending HTML response";
                return [ 
                    200, 
                    [ 'Content-Type' => 'text/html' ], 
                    [q[
                        <html>
                        <head>
                            <title>Plack::Debugger - Test</title>
                            <script type="text/javascript" src="/debugger/static/js/jquery.js"></script>
                            <script type="text/javascript">
                                $(document).ready(function () {
                                    $("#ajax-test").click(function () {
                                        $.getJSON("/api").then(function (data) {
                                            console.log(data);
                                        });
                                    });

                                    $("#ajax-test-2").click(function () {
                                        $.getJSON("/api/v2").then(function (data) {
                                            console.log(data);
                                        });
                                    });
                                });
                            </script>
                        </head>
                        <body>
                            <h1>Plack::Debugger Test</h1>
                            <hr/>
                            <p>This is a test of the Plack-Debugger</p>
                            <input id="ajax-test" type="button" value="TEST ME!" />
                            <br/>
                            <input id="ajax-test-2" type="button" value="BREAK ME!" />
                            <br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>
                            <hr/>
                        </body>
                        </html>
                    ]]
                ]
            }
        }
    }
};



