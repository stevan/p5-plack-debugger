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
use Plack::Debugger::Panel::PlackResponse;
use Plack::Debugger::Panel::PlackRequest;
use Plack::Debugger::Panel::PerlConfig;
use Plack::Debugger::Panel::Environment;
use Plack::Debugger::Panel::Parameters;
use Plack::Debugger::Panel::AJAX;
use Plack::Debugger::Panel::ModuleVersions;
use Plack::Debugger::Panel::Memory;
use Plack::Debugger::Panel::Warnings;

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
        Plack::Debugger::Panel::PlackResponse->new,
        Plack::Debugger::Panel::PlackRequest->new,
        Plack::Debugger::Panel::Parameters->new,   
        Plack::Debugger::Panel::Environment->new,   
        Plack::Debugger::Panel::PerlConfig->new,
        Plack::Debugger::Panel::AJAX->new, 
        Plack::Debugger::Panel::ModuleVersions->new,
        Plack::Debugger::Panel::Memory->new,
        Plack::Debugger::Panel::Warnings->new,
        Plack::Debugger::Panel->new(
            title => 'HTML Result Passthrough',
            after => sub { 
                my ($self, $env) = @_;
                $self->set_result(q{
                    <script>
                        function testing() {
                            return "... and yah don't stop!";
                        }
                    </script>
                    <table id="test-table">
                        <tr>
                            <td>Testing</td>
                            <td>1</td>
                            <td>2</td>
                            <td>3</td>
                        </tr>
                    </table>
                    <script>
                        $(document).ready(function () {
                            $('#test-table tr').append('<td>' + testing() + '</td>');
                        });
                    </script>
                }); 
            }
        ),
        Plack::Debugger::Panel->new(
            title     => 'Data Table Test',
            formatter => 'simple_data_table',
            after     => sub { 
                my ($self, $env) = @_;
                $self->set_result([ map { [ 0 .. 5 ] } 0 .. 10 ]); 
            }
        ),  
        Plack::Debugger::Panel->new(
            title     => 'Data Table w/headers Test',
            formatter => 'simple_data_table_w_headers',
            after     => sub { 
                my ($self, $env) = @_;
                $self->set_result([ 
                    [ 'Zero', 'One', 'Two', 'Three', 'Four', 'Five'], 
                    map { [ 0 .. 5 ] } 0 .. 10 
                ]); 
            }
        )    
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
                                        $.get("/api", function (data) {
                                            console.log(data);
                                        });
                                    });

                                    $("#ajax-test-2").click(function () {
                                        $.get("/api/v2", function (data) {
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



